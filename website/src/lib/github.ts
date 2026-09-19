import type { GitHubUser, GitHubRepo, ProfileStats, FullProfileStats, Language } from "./types";
import {
  computePersonality, computeVelocity, computeAvgPerDay, computeStreaks,
  computeWeekendPct, computePRMergeRate, computeIssueCloseRate,
} from "./analytics";
import type { Calendar, ContributionDay } from "./analytics";
import { createGitHubClient, GitHubApiError } from "./http";

const LANG_COLORS: Record<string, string> = {
  JavaScript: "#f1e05a", TypeScript: "#3178c6", Python: "#3572A5",
  Java: "#b07219", Go: "#00ADD8", Rust: "#dea584", Ruby: "#701516",
  "C++": "#f34b7d", C: "#555555", "C#": "#178600", PHP: "#4F5D95",
  Swift: "#F05138", Kotlin: "#A97BFF", Dart: "#00B4AB", Shell: "#89e051",
  HTML: "#e34c26", CSS: "#563d7c", Vue: "#41b883", Svelte: "#ff3e00",
  Lua: "#000080", Zig: "#ec915c", Elixir: "#6e4a7e", Haskell: "#5e5086",
};

// REST API - no auth required, works for public profiles
export async function fetchPublicProfile(username: string, signal?: AbortSignal): Promise<ProfileStats> {
  const client = createGitHubClient(undefined, signal);
  const path = `/users/${encodeURIComponent(username)}`;
  const user = await client.request<GitHubUser>(path);
  const repos = await client.paginate<GitHubRepo>(
    `${path}/repos?sort=full_name&direction=asc`, (repo) => repo.html_url,
  );
  repos.sort((a, b) => b.stargazers_count - a.stargazers_count);

  const totalStars = repos.reduce((sum, r) => sum + r.stargazers_count, 0);

  const langMap: Record<string, { count: number; color: string }> = {};
  let totalLangRepos = 0;
  for (const repo of repos) {
    if (repo.archived || repo.fork || !repo.language) continue;
    langMap[repo.language] ??= { count: 0, color: LANG_COLORS[repo.language] || "#8b949e" };
    langMap[repo.language].count++;
    totalLangRepos++;
  }

  const topLanguages: Language[] = Object.entries(langMap)
    .map(([name, { count, color }]) => ({
      name,
      count,
      color,
      percentage: totalLangRepos > 0 ? (count / totalLangRepos) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const originalRepos = repos.filter((r) => !r.fork && !r.archived).length;
  const forkedRepos = repos.filter((r) => r.fork).length;
  const totalForksReceived = repos.reduce((sum, r) => sum + r.forks_count, 0);
  const languageCount = Object.keys(langMap).length;
  const accountAge = new Date().getFullYear() - new Date(user.created_at).getFullYear();
  const followerRatio = user.following > 0
    ? (user.followers / user.following).toFixed(1)
    : user.followers > 0 ? "\u221e" : "0";

  return {
    user, repos, totalStars, topLanguages, originalRepos, forkedRepos,
    totalForksReceived, languageCount, accountAge, followerRatio,
  };
}

// GraphQL API - requires auth token, returns full stats
const PROFILE_QUERY = `
  query ProfileInsights($username: String!, $after: String) {
    user(login: $username) {
      name login createdAt avatarUrl
      followers { totalCount }
      following { totalCount }
      repositories(first: 100, after: $after, ownerAffiliations: OWNER, orderBy: {field: STARGAZERS, direction: DESC}) {
        totalCount
        pageInfo { hasNextPage endCursor }
        nodes {
          id name url stargazerCount forkCount
          primaryLanguage { name color }
          createdAt updatedAt isArchived isFork
        }
      }
      pullRequests(states: MERGED, first: 1) { totalCount }
      openPRs: pullRequests(states: OPEN, first: 1) { totalCount }
      closedPRs: pullRequests(states: CLOSED, first: 1) { totalCount }
      closedIssues: issues(states: CLOSED, first: 1) { totalCount }
      openIssues: issues(states: OPEN, first: 1) { totalCount }
      repositoriesContributedTo(first: 1, contributionTypes: [COMMIT, PULL_REQUEST, ISSUE]) { totalCount }
      organizations { totalCount }
    }
  }
`;

const CONTRIBUTIONS_QUERY = `
  query ContributionWindow($username: String!, $from: DateTime!, $to: DateTime!) {
    user(login: $username) {
      contributionsCollection(from: $from, to: $to) {
        totalCommitContributions
        totalPullRequestContributions
        totalPullRequestReviewContributions
        totalIssueContributions
        contributionCalendar {
          totalContributions
          weeks {
            contributionDays { contributionCount date weekday }
          }
        }
      }
    }
  }
`;

interface GraphRepo {
  id: string; name: string; url: string; stargazerCount: number; forkCount: number;
  primaryLanguage: { name: string; color: string | null } | null;
  isArchived: boolean; isFork: boolean;
}
interface GraphUser {
  name: string | null; login: string; createdAt: string; avatarUrl: string;
  followers: { totalCount: number }; following: { totalCount: number };
  repositories: {
    totalCount: number; nodes: GraphRepo[];
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  };
  pullRequests: { totalCount: number }; openPRs: { totalCount: number }; closedPRs: { totalCount: number };
  closedIssues: { totalCount: number }; openIssues: { totalCount: number };
  repositoriesContributedTo: { totalCount: number }; organizations: { totalCount: number };
}
interface Contributions {
  totalCommitContributions: number;
  totalPullRequestContributions: number;
  totalPullRequestReviewContributions: number;
  totalIssueContributions: number;
  contributionCalendar: Calendar;
}

function incomplete(message: string): never {
  throw new GitHubApiError(`GitHub returned incomplete ${message}. Please refresh.`, "invalid-response");
}

async function fetchContributions(
  username: string, client: ReturnType<typeof createGitHubClient>, now: Date,
): Promise<Contributions> {
  const dayMs = 86_400_000;
  const today = Date.parse(now.toISOString().slice(0, 10));
  const start = today - 364 * dayMs;
  const days = new Map<string, ContributionDay>();
  const totals = {
    totalCommitContributions: 0, totalPullRequestContributions: 0,
    totalPullRequestReviewContributions: 0, totalIssueContributions: 0,
  };
  // Non-overlapping calendar-day windows bound query cost for heavy profiles.
  for (let offset = 0; offset < 365; offset += 92) {
    const fromMs = start + offset * dayMs;
    const toMs = Math.min(start + (offset + 92) * dayMs - 1, now.getTime());
    const from = new Date(fromMs).toISOString();
    const to = new Date(toMs).toISOString();
    const data = await client.graphql<{ user: { contributionsCollection: Contributions } | null }>(
      CONTRIBUTIONS_QUERY, { username, from, to },
    );
    const collection = data.user?.contributionsCollection;
    if (!collection?.contributionCalendar?.weeks) incomplete("contribution data");
    for (const key of Object.keys(totals) as (keyof typeof totals)[]) {
      if (!Number.isFinite(collection[key]) || collection[key] < 0) incomplete("contribution totals");
      totals[key] += collection[key];
    }
    const windowDays = new Map<string, ContributionDay>();
    for (const week of collection.contributionCalendar.weeks) {
      if (!Array.isArray(week.contributionDays)) incomplete("contribution calendar");
      for (const day of week.contributionDays) {
        if (day.date < from.slice(0, 10) || day.date > to.slice(0, 10)) continue;
        if (!Number.isInteger(day.contributionCount) || day.contributionCount < 0) incomplete("contribution calendar");
        const duplicate = windowDays.get(day.date) ?? days.get(day.date);
        if (duplicate && duplicate.contributionCount !== day.contributionCount) incomplete("contribution calendar");
        windowDays.set(day.date, day);
      }
    }
    for (let date = fromMs; date <= toMs; date += dayMs) {
      const key = new Date(date).toISOString().slice(0, 10);
      const day = windowDays.get(key);
      if (!day) incomplete("contribution calendar");
      days.set(key, day);
    }
  }
  const contributionDays = [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
  return {
    ...totals,
    contributionCalendar: {
      totalContributions: contributionDays.reduce((sum, day) => sum + day.contributionCount, 0),
      weeks: [{ contributionDays }],
    },
  };
}

export async function fetchFullProfile(username: string, token: string, signal?: AbortSignal): Promise<FullProfileStats> {
  return fullProfile(username, createGitHubClient(token, signal));
}

// Share rate-limit state with the dashboard's other requests.
export async function fullProfile(
  username: string, client: ReturnType<typeof createGitHubClient>,
): Promise<FullProfileStats> {
  const now = new Date();
  const data = await client.graphql<{ user: GraphUser | null }>(PROFILE_QUERY, { username, after: null });
  if (!data.user) throw new GitHubApiError(`User "${username}" not found`, "not-found", 404);
  const u = data.user;
  const repositoryMap = new Map<string, GraphRepo>();
  const cursors = new Set<string>();
  let connection = u.repositories;
  while (true) {
    if (!connection?.pageInfo || !Array.isArray(connection.nodes)) incomplete("repository data");
    for (const repo of connection.nodes) {
      if (!repo?.id) incomplete("repository data");
      repositoryMap.set(repo.id, repo);
    }
    if (!connection.pageInfo.hasNextPage) break;
    const after = connection.pageInfo.endCursor;
    if (!after || cursors.has(after)) incomplete("repository pagination");
    cursors.add(after);
    const next = await client.graphql<{ user: GraphUser | null }>(PROFILE_QUERY, { username, after });
    if (!next.user) incomplete("repository data");
    connection = next.user.repositories;
  }
  if (repositoryMap.size !== u.repositories.totalCount) incomplete("repository pagination");
  u.repositories.nodes = [...repositoryMap.values()];
  const contribs = await fetchContributions(username, client, now);
  const calendar = contribs.contributionCalendar;

  const totalStars = u.repositories.nodes.reduce(
    (sum: number, r: { stargazerCount: number }) => sum + r.stargazerCount, 0,
  );

  const langMap: Record<string, { count: number; color: string }> = {};
  let totalLangRepos = 0;
  for (const repo of u.repositories.nodes) {
    if (repo.isArchived || repo.isFork || !repo.primaryLanguage) continue;
    const { name, color } = repo.primaryLanguage;
    langMap[name] ??= { count: 0, color: color ?? LANG_COLORS[name] ?? "#8b949e" };
    langMap[name].count++;
    totalLangRepos++;
  }

  const topLanguages: Language[] = Object.entries(langMap)
    .map(([name, { count, color }]) => ({
      name, count, color,
      percentage: totalLangRepos > 0 ? (count / totalLangRepos) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const repos = u.repositories.nodes;
  const originalRepos = repos.filter((r: { isFork: boolean; isArchived: boolean }) => !r.isFork && !r.isArchived).length;
  const forkedRepos = repos.filter((r: { isFork: boolean }) => r.isFork).length;
  const totalForksReceived = repos.reduce(
    (sum: number, r: { forkCount: number }) => sum + r.forkCount, 0,
  );
  const languageCount = Object.keys(langMap).length;
  const accountAge = new Date().getFullYear() - new Date(u.createdAt).getFullYear();
  const followers = u.followers.totalCount;
  const following = u.following?.totalCount ?? 0;
  const followerRatio = following > 0
    ? (followers / following).toFixed(1)
    : followers > 0 ? "\u221e" : "0";

  const streaks = computeStreaks(calendar, now);
  const personality = computePersonality(
    contribs.totalCommitContributions,
    contribs.totalPullRequestContributions,
    contribs.totalPullRequestReviewContributions,
    contribs.totalIssueContributions,
  );
  const velocity = computeVelocity(calendar, now);
  const avgPerDay = computeAvgPerDay(calendar);
  const weekendPct = computeWeekendPct(calendar);

  const mergedPRs = u.pullRequests.totalCount;
  const openPRs = u.openPRs?.totalCount ?? 0;
  const closedPRs = u.closedPRs?.totalCount ?? 0;
  const prMergeRate = computePRMergeRate(mergedPRs, openPRs, closedPRs);

  const closedIssues = u.closedIssues?.totalCount ?? 0;
  const openIssues = u.openIssues?.totalCount ?? 0;
  const issueCloseRate = computeIssueCloseRate(closedIssues, openIssues);

  const reposContributedTo = u.repositoriesContributedTo?.totalCount ?? 0;
  const organizations = u.organizations?.totalCount ?? 0;

  return {
    user: {
      login: u.login,
      name: u.name,
      avatar_url: u.avatarUrl,
      bio: null,
      public_repos: u.repositories.totalCount,
      followers,
      following,
      created_at: u.createdAt,
    },
    repos: repos.map((repo) => ({
      name: repo.name, html_url: repo.url, stargazers_count: repo.stargazerCount,
      forks_count: repo.forkCount, language: repo.primaryLanguage?.name ?? null,
      fork: repo.isFork, archived: repo.isArchived,
    })),
    totalStars,
    topLanguages,
    originalRepos,
    forkedRepos,
    totalForksReceived,
    languageCount,
    accountAge,
    followerRatio,
    totalContributions: calendar.totalContributions,
    currentStreak: streaks.currentStreak,
    longestStreak: streaks.longestStreak,
    mergedPRs,
    openPRs,
    closedPRs,
    prMergeRate,
    closedIssues,
    openIssues,
    issueCloseRate,
    weekendPct,
    reposContributedTo,
    organizations,
    personality,
    velocity,
    avgPerDay,
  };
}
