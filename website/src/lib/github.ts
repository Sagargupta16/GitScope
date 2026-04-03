import type { GitHubUser, GitHubRepo, ProfileStats, FullProfileStats, Language } from "./types";
import {
  computePersonality, computeVelocity, computeAvgPerDay, computeStreaks,
  computeWeekendPct, computePRMergeRate, computeIssueCloseRate,
} from "./analytics";

const LANG_COLORS: Record<string, string> = {
  JavaScript: "#f1e05a", TypeScript: "#3178c6", Python: "#3572A5",
  Java: "#b07219", Go: "#00ADD8", Rust: "#dea584", Ruby: "#701516",
  "C++": "#f34b7d", C: "#555555", "C#": "#178600", PHP: "#4F5D95",
  Swift: "#F05138", Kotlin: "#A97BFF", Dart: "#00B4AB", Shell: "#89e051",
  HTML: "#e34c26", CSS: "#563d7c", Vue: "#41b883", Svelte: "#ff3e00",
  Lua: "#000080", Zig: "#ec915c", Elixir: "#6e4a7e", Haskell: "#5e5086",
};

// REST API - no auth required, works for public profiles
export async function fetchPublicProfile(username: string): Promise<ProfileStats> {
  const [userRes, reposRes] = await Promise.all([
    fetch(`https://api.github.com/users/${username}`),
    fetch(`https://api.github.com/users/${username}/repos?per_page=100&sort=stars&direction=desc`),
  ]);

  if (!userRes.ok) throw new Error(`User "${username}" not found`);

  const user: GitHubUser = await userRes.json();
  const repos: GitHubRepo[] = await reposRes.json();

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
  query ProfileInsights($username: String!) {
    user(login: $username) {
      name login createdAt avatarUrl
      followers { totalCount }
      following { totalCount }
      repositories(first: 100, ownerAffiliations: OWNER, orderBy: {field: STARGAZERS, direction: DESC}) {
        totalCount
        nodes {
          name url stargazerCount forkCount
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
      contributionsCollection {
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

export async function fetchFullProfile(username: string, token: string): Promise<FullProfileStats> {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: PROFILE_QUERY, variables: { username } }),
  });

  if (!res.ok) throw new Error("GraphQL request failed");

  const { data } = await res.json();
  if (!data?.user) throw new Error(`User "${username}" not found`);

  const u = data.user;
  const contribs = u.contributionsCollection;
  const calendar = contribs.contributionCalendar;

  const totalStars = u.repositories.nodes.reduce(
    (sum: number, r: { stargazerCount: number }) => sum + r.stargazerCount, 0,
  );

  const langMap: Record<string, { count: number; color: string }> = {};
  let totalLangRepos = 0;
  for (const repo of u.repositories.nodes) {
    if (repo.isArchived || repo.isFork || !repo.primaryLanguage) continue;
    const { name, color } = repo.primaryLanguage;
    langMap[name] ??= { count: 0, color };
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

  const streaks = computeStreaks(calendar);
  const personality = computePersonality(
    contribs.totalCommitContributions,
    contribs.totalPullRequestContributions,
    contribs.totalPullRequestReviewContributions,
    contribs.totalIssueContributions,
  );
  const velocity = computeVelocity(calendar);
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
    repos: [],
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
