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

import { getCached, setCache, getCacheContext } from "./storage.js";

const REPO_FIELDS = `
  totalCount
  pageInfo { hasNextPage endCursor }
  nodes {
    name url stargazerCount forkCount
    primaryLanguage { name color }
    createdAt updatedAt isArchived isFork
  }
`;

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
        ${REPO_FIELDS}
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

const REPOS_QUERY = `
  query ProfileRepositories($username: String!, $after: String!) {
    user(login: $username) {
      repositories(first: 100, after: $after, ownerAffiliations: OWNER, orderBy: {field: STARGAZERS, direction: DESC}) {
        ${REPO_FIELDS}
      }
    }
  }
`;
const VIEWER_QUERY = `query AuthenticatedViewer { viewer { login } }`;

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
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      const error = chrome.runtime.lastError;
      if (error || !response || response.errors) {
        reject(new Error(error?.message || "GitHub could not return complete insights. Please retry."));
      } else resolve(response);
    });
  });
}

// GitHub's bounds are inclusive. Split whole UTC dates so neither category
// totals nor calendar days overlap. Include today in the rolling 365 dates.
function buildContribWindows(now = new Date(), chunks = CONTRIB_CHUNKS) {
  const dayMs = 86400000;
  const today = Date.parse(`${now.toISOString().slice(0, 10)}T00:00:00Z`);
  const start = today - 364 * dayMs;
  const windows = [];
  for (let i = 0; i < chunks; i++) {
    windows.push({
      from: new Date(start + Math.floor(i * 365 / chunks) * dayMs).toISOString(),
      to: new Date(Math.min(now.getTime(), start + Math.floor((i + 1) * 365 / chunks) * dayMs - 1)).toISOString(),
    });
  }
  return windows;
}

// Merge complete, non-overlapping date windows. Calendar padding is filtered
// before this step; duplicate dates must agree instead of silently hiding errors.
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
    for (const key of Object.keys(totals)) {
      if (!Number.isInteger(cc[key]) || cc[key] < 0) throw new Error("Incomplete contribution totals");
      totals[key] += cc[key];
    }
    const weeks = cc.contributionCalendar?.weeks ?? [];
    for (const week of weeks) {
      for (const day of week.contributionDays) {
        const previous = daysByDate.get(day.date);
        if (previous && previous.contributionCount !== day.contributionCount) {
          throw new Error("Inconsistent contribution calendar");
        }
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

const inFlight = new Map();
let authRevision = 0;
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && (changes.ghToken || changes.gpi_auth_session)) {
    authRevision++;
    inFlight.clear();
  }
});

async function cachedRequest(name, token, fetchData) {
  const revision = authRevision;
  const context = await getCacheContext(token);
  const key = `gpi_v2_${context}_${name}`;
  async function assertCurrent() {
    if (revision !== authRevision || context !== await getCacheContext(token)) {
      throw new Error("Authentication changed. Please retry.");
    }
  }
  if (inFlight.has(key)) return inFlight.get(key);
  const request = (async () => {
    await assertCurrent();
    const cached = await getCached(key);
    await assertCurrent();
    if (cached) return cached;
    const data = await fetchData();
    await assertCurrent();
    await setCache(key, data);
    await assertCurrent();
    return data;
  })();
  inFlight.set(key, request);
  try {
    return await request;
  } finally {
    if (inFlight.get(key) === request) inFlight.delete(key);
  }
}

export function fetchAuthenticatedViewer(token) {
  return cachedRequest("viewer", token, async () => {
    const data = await sendMessage({ type: "GPI_GRAPHQL", token, query: VIEWER_QUERY });
    if (!data.viewer?.login) throw new Error("Could not identify the signed-in account");
    return data.viewer;
  });
}

export function fetchProfileInsights(username, token) {
  username = username.toLowerCase();
  return cachedRequest(`profile_${username}`, token, async () => {
    const core = await sendMessage({
      type: "GPI_GRAPHQL", token, query: CORE_QUERY, variables: { username },
    });
    if (!core.user?.repositories) throw new Error("Profile not found");

    let page = core.user.repositories;
    const expectedRepos = page.totalCount;
    if (!Number.isInteger(expectedRepos) || expectedRepos < 0) throw new Error("Incomplete repository count");
    const repos = new Map();
    const cursors = new Set();
    while (true) {
      if (!Array.isArray(page.nodes) || typeof page.pageInfo?.hasNextPage !== "boolean" ||
          page.totalCount !== expectedRepos || page.nodes.some(r => !r?.url)) {
        throw new Error("Incomplete repository data");
      }
      for (const repo of page.nodes) repos.set(repo.url, repo);
      if (!page.pageInfo.hasNextPage) break;
      const after = page.pageInfo.endCursor;
      if (!after || cursors.has(after)) throw new Error("Repository pagination did not advance");
      cursors.add(after);
      const next = await sendMessage({
        type: "GPI_GRAPHQL", token, query: REPOS_QUERY, variables: { username, after },
      });
      page = next.user?.repositories;
      if (!page) throw new Error("Incomplete repository data");
    }
    if (repos.size !== expectedRepos) throw new Error("Incomplete repository data. Please retry.");
    core.user.repositories.nodes = [...repos.values()].sort((a, b) => b.stargazerCount - a.stargazerCount);

    const chunks = await Promise.all(buildContribWindows().map(async window => {
      const result = await sendMessage({
        type: "GPI_GRAPHQL", token, query: CONTRIB_QUERY,
        variables: { username, ...window },
      });
      const cc = result.user?.contributionsCollection;
      if (!Array.isArray(cc?.contributionCalendar?.weeks)) throw new Error("Incomplete contribution history");
      const days = new Map();
      // Ignore any calendar padding outside the requested date range.
      for (const week of cc.contributionCalendar.weeks) {
        if (!Array.isArray(week.contributionDays)) throw new Error("Incomplete contribution calendar");
        for (const day of week.contributionDays) {
          if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day.date)) throw new Error("Invalid contribution date");
          if (day.date < window.from.slice(0, 10) || day.date > window.to.slice(0, 10)) continue;
          if (!Number.isInteger(day.contributionCount) || day.contributionCount < 0) {
            throw new Error("Invalid contribution count");
          }
          if (days.has(day.date) && days.get(day.date).contributionCount !== day.contributionCount) {
            throw new Error("Inconsistent contribution calendar");
          }
          days.set(day.date, { ...day, weekday: new Date(`${day.date}T00:00:00Z`).getUTCDay() });
        }
      }
      for (let time = Date.parse(window.from); time <= Date.parse(window.to); time += 86400000) {
        if (!days.has(new Date(time).toISOString().slice(0, 10))) throw new Error("Incomplete contribution calendar");
      }
      return {
        ...cc,
        contributionCalendar: {
          ...cc.contributionCalendar,
          weeks: [{ contributionDays: [...days.values()] }],
        },
      };
    }));
    core.user.contributionsCollection = mergeContributions(chunks);
    return core;
  });
}
