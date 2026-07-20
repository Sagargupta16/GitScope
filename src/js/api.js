// GitHub GraphQL API - parameterized queries via background service worker
//
// GitHub scores each GraphQL query against a per-query compute budget and
// rejects expensive ones with RESOURCE_LIMITS_EXCEEDED (nulling the whole
// `user`). Heavy accounts (thousands of contributions/year, 100 repos) blow
// that budget when the profile, repos, and a full year of contribution history
// are fetched in one shot. So we split the work:
//   1. CORE_QUERY  - profile fields, repos, and cheap indexed counts.
//   2. CONTRIB_QUERY - contributionsCollection for a bounded date window; the
//      history-scanning fields are the expensive part, so we fetch a full year
//      as several smaller windows in parallel and stitch the results back into
//      the single `contributionsCollection` shape the rest of the code expects.

import { getCached, setCache } from "./storage.js";

const CORE_QUERY = `
  query ProfileCore($username: String!) {
    user(login: $username) {
      name
      login
      createdAt
      avatarUrl
      followers { totalCount }
      following { totalCount }
      starredRepositories { totalCount }
      gists { totalCount }
      repositories(first: 100, ownerAffiliations: OWNER, orderBy: {field: STARGAZERS, direction: DESC}) {
        totalCount
        nodes {
          name
          url
          stargazerCount
          forkCount
          primaryLanguage { name color }
          createdAt
          updatedAt
          isArchived
          isFork
        }
      }
      pullRequests(states: MERGED, first: 1) { totalCount }
      openPRs: pullRequests(states: OPEN, first: 1) { totalCount }
      closedPRs: pullRequests(states: CLOSED, first: 1) { totalCount }
      issues(first: 1) { totalCount }
      closedIssues: issues(states: CLOSED, first: 1) { totalCount }
      openIssues: issues(states: OPEN, first: 1) { totalCount }
      repositoriesContributedTo(first: 1, contributionTypes: [COMMIT, PULL_REQUEST, ISSUE]) { totalCount }
      organizations { totalCount }
    }
  }
`;

const CONTRIB_QUERY = `
  query ProfileContrib($username: String!, $from: DateTime!, $to: DateTime!) {
    user(login: $username) {
      contributionsCollection(from: $from, to: $to) {
        totalCommitContributions
        totalPullRequestContributions
        totalPullRequestReviewContributions
        totalIssueContributions
        totalRepositoryContributions
        contributionCalendar {
          totalContributions
          weeks {
            contributionDays {
              contributionCount
              date
              weekday
            }
          }
        }
      }
    }
  }
`;

// Fetch a full year of contributions as this many equal windows. GitHub's
// budget comfortably fits a ~3-month window even for heavy accounts.
const CONTRIB_CHUNKS = 4;

function sendMessage(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      resolve(response);
    });
  });
}

// Build [from, to) ISO windows spanning the last 365 days, oldest first.
function buildContribWindows(now = new Date(), chunks = CONTRIB_CHUNKS) {
  const end = now.getTime();
  const start = end - 365 * 24 * 60 * 60 * 1000;
  const step = (end - start) / chunks;
  const windows = [];
  for (let i = 0; i < chunks; i++) {
    windows.push({
      from: new Date(start + i * step).toISOString(),
      to: new Date(start + (i + 1) * step).toISOString(),
    });
  }
  return windows;
}

// Merge date-bounded contributionsCollection chunks into one object matching the
// shape of an unbounded contributionsCollection query. Aggregate totals sum;
// calendar days are deduped by date (windows share a boundary day) and regrouped
// into whole weeks so downstream week-based logic keeps working.
function mergeContributions(chunks) {
  const totals = {
    totalCommitContributions: 0,
    totalPullRequestContributions: 0,
    totalPullRequestReviewContributions: 0,
    totalIssueContributions: 0,
    totalRepositoryContributions: 0,
  };

  const daysByDate = new Map();
  for (const cc of chunks) {
    if (!cc) continue;
    for (const key of Object.keys(totals)) {
      totals[key] += cc[key] ?? 0;
    }
    const weeks = cc.contributionCalendar?.weeks ?? [];
    for (const week of weeks) {
      for (const day of week.contributionDays) {
        // Last write wins; boundary days are identical across adjacent windows.
        daysByDate.set(day.date, day);
      }
    }
  }

  const days = [...daysByDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  const totalContributions = days.reduce((s, d) => s + d.contributionCount, 0);

  // Regroup into weeks aligned on weekday (0 = Sunday), matching GitHub's layout.
  const regrouped = [];
  let current = null;
  for (const day of days) {
    if (day.weekday === 0 || current === null) {
      current = { contributionDays: [] };
      regrouped.push(current);
    }
    current.contributionDays.push(day);
  }

  return {
    ...totals,
    contributionCalendar: {
      totalContributions,
      weeks: regrouped,
    },
  };
}

export async function fetchProfileInsights(username, token) {
  const cacheKey = `gpi_profile_${username}`;
  const cached = await getCached(cacheKey);
  if (cached) {
    console.log("[GPI] Using cached data for", username);
    return cached;
  }

  const core = await sendMessage({
    type: "GPI_GRAPHQL",
    token,
    query: CORE_QUERY,
    variables: { username },
  });

  if (!core?.user) return core;

  const windows = buildContribWindows();
  const chunks = await Promise.all(
    windows.map((w) =>
      sendMessage({
        type: "GPI_GRAPHQL",
        token,
        query: CONTRIB_QUERY,
        variables: { username, from: w.from, to: w.to },
      }).then((res) => res?.user?.contributionsCollection ?? null)
    )
  );

  core.user.contributionsCollection = mergeContributions(chunks);

  await setCache(cacheKey, core);
  return core;
}
