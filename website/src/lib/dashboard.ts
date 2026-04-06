import type {
  GitHubUser,
  DashboardData,
  DashboardRepo,
  TrafficData,
  CloneData,
  Referrer,
  TrafficDay,
  RepoTraffic,
} from "./types";

const GITHUB_API = "https://api.github.com";

function headers(token: string): HeadersInit {
  return {
    Authorization: `bearer ${token}`,
    Accept: "application/vnd.github+json",
  };
}

async function ghFetch<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${GITHUB_API}${path}`, { headers: headers(token) });
  if (res.status === 403 && res.headers.get("x-ratelimit-remaining") === "0") {
    throw new Error("GitHub API rate limit exceeded. Please wait a few minutes.");
  }
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
  return res.json();
}

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
async function fetchAllRepos(token: string): Promise<GitHubRepoRaw[]> {
  const repos: GitHubRepoRaw[] = [];
  let page = 1;
  while (page <= 10) {
    const batch = await ghFetch<GitHubRepoRaw[]>(
      `/user/repos?type=owner&sort=stars&direction=desc&per_page=100&page=${page}`,
      token,
    );
    repos.push(...batch);
    if (batch.length < 100) break;
    page++;
  }
  return repos;
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
  return entries.map((e) => ({
    date: e.timestamp.split("T")[0],
    count: e.count,
    uniques: e.uniques,
  }));
}

// Fetch traffic for a single repo (requires repo scope)
async function fetchRepoTraffic(
  owner: string,
  repo: string,
  token: string,
): Promise<{ views: TrafficData; clones: CloneData; referrers: Referrer[] }> {
  try {
    const [rawViews, rawClones, referrers] = await Promise.all([
      ghFetch<GitHubTrafficViews>(`/repos/${owner}/${repo}/traffic/views`, token),
      ghFetch<GitHubTrafficClones>(`/repos/${owner}/${repo}/traffic/clones`, token),
      ghFetch<Referrer[]>(`/repos/${owner}/${repo}/traffic/popular/referrers`, token),
    ]);
    return {
      views: {
        count: rawViews.count,
        uniques: rawViews.uniques,
        views: normalizeTrafficEntries(rawViews.views),
      },
      clones: {
        count: rawClones.count,
        uniques: rawClones.uniques,
        clones: normalizeTrafficEntries(rawClones.clones),
      },
      referrers,
    };
  } catch {
    // Traffic endpoints return 403 for repos without push access (forks, etc.)
    return {
      views: { count: 0, uniques: 0, views: [] },
      clones: { count: 0, uniques: 0, clones: [] },
      referrers: [],
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

// Fetch traffic for a single repo (public API for RepoDetail page)
export async function fetchRepoDetail(
  owner: string,
  repo: string,
  token: string,
): Promise<RepoTraffic> {
  const { views, clones, referrers } = await fetchRepoTraffic(owner, repo, token);
  return { repo, views, clones, referrers };
}

// Main dashboard data fetch
export async function fetchDashboardData(
  token: string,
  onProgress?: (msg: string) => void,
): Promise<DashboardData> {
  onProgress?.("Fetching profile...");
  const user = await ghFetch<GitHubUser>("/user", token);

  onProgress?.("Fetching repositories...");
  const rawRepos = await fetchAllRepos(token);
  const ownedRepos = rawRepos.filter((r) => !r.fork && !r.archived);

  onProgress?.(`Fetching traffic for ${ownedRepos.length} repos...`);

  // Batch traffic fetches (5 at a time to avoid rate limits)
  const trafficResults: {
    repo: string;
    views: TrafficData;
    clones: CloneData;
    referrers: Referrer[];
  }[] = [];

  const batchSize = 5;
  for (let i = 0; i < ownedRepos.length; i += batchSize) {
    const batch = ownedRepos.slice(i, i + batchSize);
    onProgress?.(
      `Fetching traffic ${i + 1}-${Math.min(i + batchSize, ownedRepos.length)} of ${ownedRepos.length}...`,
    );
    const results = await Promise.all(
      batch.map(async (r) => ({
        repo: r.name,
        ...(await fetchRepoTraffic(user.login, r.name, token)),
      })),
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
      totalViews: traffic?.views.count ?? 0,
      totalClones: traffic?.clones.count ?? 0,
      uniqueVisitors: traffic?.views.uniques ?? 0,
    };
  });

  // Aggregate totals
  const totalViews = trafficResults.reduce((s, t) => s + t.views.count, 0);
  const totalUniqueVisitors = trafficResults.reduce((s, t) => s + t.views.uniques, 0);
  const totalClones = trafficResults.reduce((s, t) => s + t.clones.count, 0);
  const totalUniqueCloners = trafficResults.reduce((s, t) => s + t.clones.uniques, 0);
  const totalStars = ownedRepos.reduce((s, r) => s + r.stargazers_count, 0);
  const totalForks = ownedRepos.reduce((s, r) => s + r.forks_count, 0);

  // Merge timelines
  const viewsTimeline = mergeTimelines(trafficResults.map((t) => t.views.views));
  const clonesTimeline = mergeTimelines(trafficResults.map((t) => t.clones.clones));
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
  };
}
