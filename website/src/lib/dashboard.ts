import type {
  GitHubUser,
  FullProfileStats,
  DashboardData,
  DashboardRepo,
  Referrer,
  TrafficDay,
  RepoDetailData,
  WeeklyCommitActivity,
  ParticipationData,
  RepoTraffic,
} from "./types";
import { fullProfile } from "./github";
import { createGitHubClient, errorMessage, GitHubApiError, throwIfAborted } from "./http";
type Client = ReturnType<typeof createGitHubClient>;

interface GitHubRepoRaw {
  name: string;
  html_url: string;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  language: string | null;
  fork: boolean;
  archived: boolean;
  description: string | null;
  updated_at: string;
}

// Fetch all owned repos (paginated)
async function fetchAllRepos(client: Client): Promise<GitHubRepoRaw[]> {
  const repos = await client.paginate<GitHubRepoRaw>(
    "/user/repos?type=owner&sort=full_name&direction=asc", (repo) => repo.html_url,
  );
  return repos.sort((a, b) => b.stargazers_count - a.stargazers_count);
}

// GitHub API returns "timestamp" not "date" for traffic entries
interface GitHubTrafficEntry {
  timestamp: string;
  count: number;
  uniques: number;
}

interface GitHubTrafficViews {
  count: number;
  uniques: number;
  views: GitHubTrafficEntry[];
}

interface GitHubTrafficClones {
  count: number;
  uniques: number;
  clones: GitHubTrafficEntry[];
}

// Normalize GitHub API timestamp to our TrafficDay date format
function normalizeTrafficEntries(entries: GitHubTrafficEntry[]): TrafficDay[] {
  if (!Array.isArray(entries) || entries.some((entry) =>
    typeof entry.timestamp !== "string" || !Number.isFinite(Date.parse(entry.timestamp)) ||
    !validCount(entry.count) || !validCount(entry.uniques))) {
    throw new GitHubApiError("GitHub returned invalid traffic.", "invalid-response");
  }
  return entries.map((e) => ({
    date: e.timestamp.split("T")[0],
    count: e.count,
    uniques: e.uniques,
  }));
}

function unavailableTraffic(repo: string, warning: string): RepoTraffic {
  return {
    repo,
    // Keep the legacy numeric payload shape; status, not these placeholders,
    // determines availability. Public repo totals use null for missing data.
    views: { status: "unavailable", count: 0, uniques: 0, views: [] },
    clones: { status: "unavailable", count: 0, uniques: 0, clones: [] },
    referrers: [],
    warnings: [warning],
  };
}

function validCount(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

// Each endpoint settles independently: denied clones must not erase valid views.
async function fetchRepoTraffic(
  owner: string,
  repo: string,
  client: Client,
  signal?: AbortSignal,
): Promise<RepoTraffic> {
  const path = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/traffic`;
  const [views, clones, referrers] = await Promise.allSettled([
    client.request<GitHubTrafficViews>(`${path}/views`),
    client.request<GitHubTrafficClones>(`${path}/clones`),
    client.request<Referrer[]>(`${path}/popular/referrers`),
  ]);
  throwIfAborted(signal);
  const result = unavailableTraffic(repo, "");
  result.warnings = [];
  if (views.status === "fulfilled") {
    try {
      if (!validCount(views.value?.count) || !validCount(views.value?.uniques)) throw new Error("Invalid traffic");
      result.views = {
        status: "ok", count: views.value.count, uniques: views.value.uniques,
        views: normalizeTrafficEntries(views.value.views),
      };
    } catch { result.warnings.push(`${repo}: views unavailable (invalid response).`); }
  } else result.warnings.push(`${repo}: views unavailable. ${errorMessage(views.reason)}`);
  if (clones.status === "fulfilled") {
    try {
      if (!validCount(clones.value?.count) || !validCount(clones.value?.uniques)) throw new Error("Invalid traffic");
      result.clones = {
        status: "ok", count: clones.value.count, uniques: clones.value.uniques,
        clones: normalizeTrafficEntries(clones.value.clones),
      };
    } catch { result.warnings.push(`${repo}: clones unavailable (invalid response).`); }
  } else result.warnings.push(`${repo}: clones unavailable. ${errorMessage(clones.reason)}`);
  if (referrers.status === "fulfilled" && Array.isArray(referrers.value) && referrers.value.every((referrer) =>
    typeof referrer?.referrer === "string" && validCount(referrer.count) && validCount(referrer.uniques))) {
    result.referrers = referrers.value;
  } else {
    result.warnings.push(`${repo}: referrers unavailable.${referrers.status === "rejected" ? ` ${errorMessage(referrers.reason)}` : ""}`);
  }
  return result;
}

interface RepoInfoRaw extends Omit<RepoDetailData["info"], "license"> {
  license: { spdx_id: string } | null;
}

async function optionalStatistics<T>(
  client: Client, path: string, valid: (value: T) => boolean, signal?: AbortSignal,
): Promise<{ value: T | null; warning?: string; pending: boolean }> {
  try {
    const value = await client.statistics<T>(path);
    if (!valid(value)) throw new GitHubApiError("GitHub returned invalid statistics.", "invalid-response");
    return { value, pending: false };
  } catch (error) {
    throwIfAborted(signal);
    return {
      value: null, warning: errorMessage(error),
      pending: error instanceof GitHubApiError && error.kind === "pending",
    };
  }
}

// Merge daily traffic timelines across repos
function mergeTimelines(timelines: TrafficDay[][]): TrafficDay[] {
  const map = new Map<string, { count: number; uniques: number }>();
  for (const timeline of timelines) {
    for (const day of timeline) {
      const date = day.date.split("T")[0]; // normalize "2026-04-01T00:00:00Z" -> "2026-04-01"
      const existing = map.get(date);
      if (existing) {
        existing.count += day.count;
        existing.uniques += day.uniques;
      } else {
        map.set(date, { count: day.count, uniques: day.uniques });
      }
    }
  }
  return Array.from(map.entries())
    .map(([date, data]) => ({ date, ...data }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// Aggregate referrers across repos
function mergeReferrers(allReferrers: Referrer[][]): Referrer[] {
  const map = new Map<string, { count: number; uniques: number }>();
  for (const refs of allReferrers) {
    for (const r of refs) {
      const existing = map.get(r.referrer);
      if (existing) {
        existing.count += r.count;
        existing.uniques += r.uniques;
      } else {
        map.set(r.referrer, { count: r.count, uniques: r.uniques });
      }
    }
  }
  return Array.from(map.entries())
    .map(([referrer, data]) => ({ referrer, ...data }))
    .sort((a, b) => b.count - a.count);
}

// Fetch full repo detail with traffic + commit activity + participation
export async function fetchRepoDetail(
  owner: string,
  repo: string,
  token: string,
  signal?: AbortSignal,
): Promise<RepoDetailData> {
  const client = createGitHubClient(token, signal);
  const path = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const info = await client.request<RepoInfoRaw>(path);
  const [traffic, activity, participation] = await Promise.all([
    fetchRepoTraffic(owner, repo, client, signal),
    optionalStatistics<WeeklyCommitActivity[]>(client, `${path}/stats/commit_activity`,
      (value) => Array.isArray(value) && value.every((week) => week &&
        validCount(week.week) && validCount(week.total) &&
        Array.isArray(week.days) && week.days.length === 7 && week.days.every(validCount)), signal),
    optionalStatistics<ParticipationData>(client, `${path}/stats/participation`,
      (value) => Boolean(value && Array.isArray(value.all) && Array.isArray(value.owner) &&
        value.all.every(validCount) && value.owner.every(validCount) && value.all.length === value.owner.length), signal),
  ]);
  const warnings = [...traffic.warnings];
  if (activity.warning) warnings.push(`Commit activity unavailable. ${activity.warning}`);
  if (participation.warning) warnings.push(`Participation unavailable. ${participation.warning}`);
  return {
    traffic,
    warnings,
    statisticsPending: activity.pending || participation.pending,
    info: {
      stargazers_count: info.stargazers_count,
      forks_count: info.forks_count,
      open_issues_count: info.open_issues_count,
      description: info.description,
      html_url: info.html_url,
      language: info.language,
      size: info.size,
      license: info.license?.spdx_id ?? null,
      topics: info.topics ?? [],
      created_at: info.created_at,
      pushed_at: info.pushed_at,
      has_pages: info.has_pages,
      has_wiki: info.has_wiki,
      default_branch: info.default_branch,
      watchers_count: info.watchers_count,
      subscribers_count: info.subscribers_count,
    },
    commitActivity: activity.value ?? [],
    participation: participation.value,
  };
}

// Main dashboard data fetch
export async function fetchDashboardData(
  token: string,
  onProgress?: (msg: string) => void,
  signal?: AbortSignal,
): Promise<DashboardData> {
  const client = createGitHubClient(token, signal);
  const warnings: string[] = [];
  onProgress?.("Fetching profile...");
  const user = await client.request<GitHubUser>("/user");

  onProgress?.("Fetching repositories...");
  const rawRepos = await fetchAllRepos(client);
  const ownedRepos = rawRepos.filter((r) => !r.fork && !r.archived);

  onProgress?.("Fetching profile stats...");
  let profile: FullProfileStats | null = null;
  try {
    profile = await fullProfile(user.login, client);
  } catch (error) {
    throwIfAborted(signal);
    warnings.push(`Profile statistics unavailable. ${errorMessage(error)}`);
  }

  onProgress?.(`Fetching traffic for ${ownedRepos.length} repos...`);

  // Batch traffic fetches (5 at a time to avoid rate limits)
  const trafficResults: RepoTraffic[] = [];

  const batchSize = 5;
  for (let i = 0; i < ownedRepos.length; i += batchSize) {
    throwIfAborted(signal);
    if (client.rateLimited) {
      const warning = "Remaining traffic unavailable because GitHub rate limited this refresh.";
      warnings.push(warning);
      trafficResults.push(...ownedRepos.slice(i).map((repo) => unavailableTraffic(repo.name, warning)));
      break;
    }
    const batch = ownedRepos.slice(i, i + batchSize);
    onProgress?.(
      `Fetching traffic ${i + 1}-${Math.min(i + batchSize, ownedRepos.length)} of ${ownedRepos.length}...`,
    );
    const results = await Promise.all(
      batch.map((r) => fetchRepoTraffic(user.login, r.name, client, signal)),
    );
    trafficResults.push(...results);
  }

  // Build dashboard repos with traffic
  const trafficMap = new Map(trafficResults.map((t) => [t.repo, t]));
  const dashboardRepos: DashboardRepo[] = ownedRepos.map((r) => {
    const traffic = trafficMap.get(r.name);
    return {
      name: r.name,
      html_url: r.html_url,
      stargazers_count: r.stargazers_count,
      forks_count: r.forks_count,
      open_issues_count: r.open_issues_count,
      language: r.language,
      fork: r.fork,
      archived: r.archived,
      description: r.description,
      updated_at: r.updated_at,
      totalViews: traffic?.views.status === "ok" ? traffic.views.count : null,
      totalClones: traffic?.clones.status === "ok" ? traffic.clones.count : null,
      uniqueVisitors: traffic?.views.status === "ok" ? traffic.views.uniques : null,
    };
  });

  // Aggregate totals
  const availableViews = trafficResults.filter((t) => t.views.status === "ok");
  const availableClones = trafficResults.filter((t) => t.clones.status === "ok");
  const totalViews = availableViews.reduce((s, t) => s + t.views.count, 0);
  const totalUniqueVisitors = availableViews.reduce((s, t) => s + t.views.uniques, 0);
  const totalClones = availableClones.reduce((s, t) => s + t.clones.count, 0);
  const totalUniqueCloners = availableClones.reduce((s, t) => s + t.clones.uniques, 0);
  const totalStars = ownedRepos.reduce((s, r) => s + r.stargazers_count, 0);
  const totalForks = ownedRepos.reduce((s, r) => s + r.forks_count, 0);

  // Merge timelines
  const viewsTimeline = mergeTimelines(availableViews.map((t) => t.views.views));
  const clonesTimeline = mergeTimelines(availableClones.map((t) => t.clones.clones));
  const referrers = mergeReferrers(trafficResults.map((t) => t.referrers));

  return {
    user,
    repos: dashboardRepos,
    totalViews,
    totalUniqueVisitors,
    totalClones,
    totalUniqueCloners,
    totalStars,
    totalForks,
    viewsTimeline,
    clonesTimeline,
    referrers,
    lastSynced: new Date().toISOString(),
    profile,
    warnings: [...new Set([...warnings, ...trafficResults.flatMap((traffic) => traffic.warnings)])],
    trafficCoverage: { views: availableViews.length, clones: availableClones.length, total: ownedRepos.length },
  };
}
