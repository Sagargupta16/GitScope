const test = require("node:test");
const assert = require("node:assert/strict");
const { loadModule: loadSource } = require("./helpers.cjs");

const now = "2026-09-19T12:00:00Z";
class FixedDate extends Date {
  constructor(...args) { super(...(args.length ? args : [now])); }
  static now() { return new Date(now).getTime(); }
}
function loadModule(relativePath, globals = {}) {
  return loadSource(relativePath, {
    Date: FixedDate, DOMException,
    setTimeout: (fn, ms) => setTimeout(fn, Math.min(ms, 5)), clearTimeout,
    ...globals,
  });
}
const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers });
const user = {
  login: "octo", name: "Octo", avatar_url: "", bio: null,
  public_repos: 101, followers: 2, following: 1, public_gists: 0,
  created_at: "2020-01-01T00:00:00Z",
};
const repo = (n, overrides = {}) => ({
  id: n, name: `repo-${n}`, html_url: `https://github.com/octo/repo-${n}`,
  stargazers_count: 1, forks_count: 2, language: "JavaScript", fork: false,
  archived: false, open_issues_count: 0, description: null, updated_at: now,
  ...overrides,
});
const gqlRepo = (n) => ({
  id: `R_${n}`, name: `repo-${n}`, url: `https://github.com/octo/repo-${n}`,
  stargazerCount: 1, forkCount: 2, primaryLanguage: { name: "JavaScript", color: "#fff" },
  createdAt: user.created_at, updatedAt: now, isArchived: false, isFork: false,
});
function contributionCollection(from, to) {
  const days = [];
  for (let d = new Date(from.slice(0, 10)); d <= new Date(to.slice(0, 10)); d.setUTCDate(d.getUTCDate() + 1)) {
    days.push({ date: d.toISOString().slice(0, 10), weekday: d.getUTCDay(), contributionCount: 1 });
  }
  return {
    totalCommitContributions: days.length, totalPullRequestContributions: 0,
    totalPullRequestReviewContributions: 0, totalIssueContributions: 0,
    contributionCalendar: { totalContributions: days.length, weeks: [{ contributionDays: days }] },
  };
}
function graphFetch({ failWindow = 0, missingDay = false, duplicateDays = false } = {}) {
  let windows = 0;
  return async (_url, init) => {
    const { query, variables } = JSON.parse(init.body);
    if (query.includes("contributionsCollection") && variables.from) {
      windows++;
      if (windows === failWindow) return json({ data: { user: null }, errors: [{ message: "contribution timeout" }] });
      const collection = contributionCollection(variables.from, variables.to);
      const days = collection.contributionCalendar.weeks[0].contributionDays;
      if (missingDay) days.pop();
      if (duplicateDays) days.push({ ...days[0] });
      return json({ data: { user: { contributionsCollection: collection } } });
    }
    const nodes = variables.after ? [gqlRepo(101)] : Array.from({ length: 100 }, (_, i) => gqlRepo(i + 1));
    return json({ data: { user: {
      name: user.name, login: user.login, createdAt: user.created_at, avatarUrl: "",
      followers: { totalCount: 2 }, following: { totalCount: 1 },
      repositories: { totalCount: 101, nodes, pageInfo: { hasNextPage: !variables.after, endCursor: variables.after ? "end" : "next" } },
      pullRequests: { totalCount: 2 }, openPRs: { totalCount: 1 }, closedPRs: { totalCount: 1 },
      closedIssues: { totalCount: 2 }, openIssues: { totalCount: 1 },
      repositoriesContributedTo: { totalCount: 2 }, organizations: { totalCount: 1 },
      contributionsCollection: contributionCollection("2025-09-20", "2026-09-19"),
    } } });
  };
}
function calendar(days) {
  return { totalContributions: days.reduce((s, d) => s + d.contributionCount, 0), weeks: [{ contributionDays: days }] };
}
const day = (date, count) => ({ date, contributionCount: count, weekday: new Date(date).getUTCDay() });

test("public profile includes repo 101 and uses a supported REST sort", async () => {
  const api = loadModule("website/src/lib/github.ts", { fetch: async (url) => {
    const u = new URL(url);
    if (!u.pathname.endsWith("/repos")) return json(user);
    assert.ok(["created", "updated", "pushed", "full_name"].includes(u.searchParams.get("sort")));
    return json(u.searchParams.get("page") === "2" ? [repo(101)] : Array.from({ length: 100 }, (_, i) => repo(i + 1)));
  } });
  const result = await api.fetchPublicProfile("octo");
  assert.equal(result.repos.length, 101);
  assert.equal(result.totalStars, 101);
  assert.equal(result.totalForksReceived, 202);
});

test("GraphQL profile paginates repositories and deduplicates complete rolling calendar", async () => {
  const api = loadModule("website/src/lib/github.ts", { fetch: graphFetch({ duplicateDays: true }) });
  const result = await api.fetchFullProfile("octo", "token");
  assert.equal(result.repos.length, 101);
  assert.equal(result.totalStars, 101);
  assert.equal(result.totalContributions, 365);
  assert.equal(result.currentStreak, 365);
});

test("required GraphQL contribution errors and missing days fail the whole profile", async () => {
  for (const options of [{ failWindow: 2 }, { missingDay: true }]) {
    const api = loadModule("website/src/lib/github.ts", { fetch: graphFetch(options) });
    await assert.rejects(api.fetchFullProfile("octo", "token"), /contribution|incomplete/i);
  }
});

test("streak permits only today's zero and breaks on missing calendar dates", () => {
  const { computeStreaks } = loadModule("website/src/lib/analytics.ts");
  assert.equal(computeStreaks(calendar([day("2026-09-16", 1), day("2026-09-17", 1), day("2026-09-18", 0), day("2026-09-19", 0)])).currentStreak, 0);
  assert.equal(computeStreaks(calendar([day("2026-09-17", 1), day("2026-09-18", 1), day("2026-09-19", 0)])).currentStreak, 2);
  const gap = computeStreaks(calendar([day("2026-09-16", 1), day("2026-09-18", 1), day("2026-09-19", 1)]));
  assert.equal(gap.currentStreak, 2);
  assert.equal(gap.longestStreak, 2);
  assert.equal(computeStreaks(calendar([day("2020-01-01", 1)])).currentStreak, 0);
});

test("velocity uses 28 complete days against prior 28 and excludes today's spike", () => {
  const { computeVelocity } = loadModule("website/src/lib/analytics.ts");
  const days = [];
  for (let i = 56; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    days.push(day(d.toISOString().slice(0, 10), i === 0 ? 999 : i <= 28 ? 2 : 1));
  }
  const result = computeVelocity(calendar(days));
  assert.equal(result.trend, "up");
  assert.equal(result.ratio, 2);
});

function dashboardFetch({ statsStatus = 200, forbiddenClones = true, reposCount = 1, rateTraffic = false } = {}) {
  return async (url) => {
    const u = new URL(url);
    if (u.pathname === "/graphql") return json({ errors: [{ message: "GraphQL unavailable" }] });
    if (u.pathname === "/user") return json(user);
    if (u.pathname === "/user/repos") {
      assert.ok(["created", "updated", "pushed", "full_name"].includes(u.searchParams.get("sort")));
      const page = Number(u.searchParams.get("page") || 1);
      return json(Array.from({ length: Math.max(0, Math.min(100, reposCount - (page - 1) * 100)) }, (_, i) => repo((page - 1) * 100 + i + 1)));
    }
    if (u.pathname.endsWith("/traffic/views")) {
      if (rateTraffic) return json({ message: "secondary rate limit" }, 403, { "retry-after": "60" });
      return json({ count: 9, uniques: 3, views: [{ timestamp: "2026-09-18T00:00:00Z", count: 9, uniques: 3 }] });
    }
    if (u.pathname.endsWith("/traffic/clones")) return forbiddenClones
      ? json({ message: "Resource not accessible" }, 403)
      : json({ count: 2, uniques: 1, clones: [] });
    if (u.pathname.endsWith("/traffic/popular/referrers")) return json([{ referrer: "github.com", count: 2, uniques: 1 }]);
    if (u.pathname.includes("/stats/")) {
      if (statsStatus === 204) return new Response(null, { status: 204 });
      if (statsStatus === 202) return json({}, 202);
      return u.pathname.endsWith("/participation") ? json({ all: [2], owner: [1] }) : json([]);
    }
    return json({ ...repo(1), size: 1, license: null, topics: [], created_at: user.created_at,
      pushed_at: now, has_pages: false, has_wiki: true, default_branch: "main", watchers_count: 1, subscribers_count: 1 });
  };
}

test("partial traffic preserves views and referrers and exposes unavailable clones", async () => {
  const { fetchDashboardData } = loadModule("website/src/lib/dashboard.ts", { fetch: dashboardFetch() });
  const result = await fetchDashboardData("token");
  assert.equal(result.totalViews, 9);
  assert.equal(result.totalUniqueVisitors, 3);
  assert.equal(result.repos[0].totalClones, null);
  assert.equal(result.trafficCoverage.views, 1);
  assert.equal(result.trafficCoverage.clones, 0);
  assert.equal(result.referrers[0].count, 2);
  assert.ok(result.warnings.length);
});

test("dashboard does not truncate after 1000 repositories", async () => {
  const { fetchDashboardData } = loadModule("website/src/lib/dashboard.ts", {
    fetch: dashboardFetch({ reposCount: 1001, forbiddenClones: false }),
  });
  const result = await fetchDashboardData("token");
  assert.equal(result.repos.length, 1001);
  assert.equal(result.totalViews, 9009);
  assert.equal(result.trafficCoverage.total, 1001);
});

test("202 and 204 optional statistics keep useful repo detail with bounded retries", async () => {
  for (const statsStatus of [202, 204]) {
    let statsCalls = 0;
    const fetch = dashboardFetch({ statsStatus });
    const api = loadModule("website/src/lib/dashboard.ts", { fetch: (url, init) => {
      if (url.includes("/stats/")) statsCalls++;
      assert.ok(statsCalls <= 6, "statistics retries must be bounded");
      return fetch(url, init);
    } });
    const result = await api.fetchRepoDetail("octo", "repo-1", "token");
    assert.equal(result.info.stargazers_count, 1);
    assert.equal(result.traffic.views.count, 9);
    assert.equal(result.traffic.clones.status, "unavailable");
    assert.equal(result.statisticsPending, true);
    assert.ok(result.warnings.length);
  }
});

test("REST primary/secondary limits and auth errors are classified without pretending user missing", async () => {
  for (const [status, headers, message, kind] of [
    [403, { "x-ratelimit-remaining": "0" }, "API rate limit exceeded", "rate-limit"],
    [403, { "retry-after": "60" }, "secondary rate limit", "rate-limit"],
    [429, {}, "Too many requests", "rate-limit"],
    [401, {}, "Bad credentials", "unauthorized"],
    [403, {}, "Resource not accessible", "forbidden"],
  ]) {
    const api = loadModule("website/src/lib/github.ts", { fetch: async () => json({ message }, status, headers) });
    await assert.rejects(api.fetchPublicProfile("octo"), (err) => err.kind === kind && err.status === status);
  }
});

test("aborted requests do not start network calls or become optional-data warnings", async () => {
  const abort = new AbortController();
  abort.abort();
  const api = loadModule("website/src/lib/dashboard.ts", { fetch: async () => assert.fail("network must not start") });
  await assert.rejects(api.fetchDashboardData("token", undefined, abort.signal), { name: "AbortError" });
});

test("leaderboard includes 101st repo, all following pages, and case-insensitive viewer deduplication", async () => {
  const api = loadModule("website/src/lib/leaderboard.ts", { fetch: async (url) => {
    const u = new URL(url);
    if (u.pathname === "/user") return json(user);
    if (u.pathname === "/user/following") return json(u.searchParams.get("page") === "2"
      ? [{ login: "OCTO" }]
      : Array.from({ length: 100 }, (_, i) => ({ login: `friend-${i}` })));
    if (u.pathname.endsWith("/repos")) {
      assert.ok(["created", "updated", "pushed", "full_name"].includes(u.searchParams.get("sort")));
      return json(u.searchParams.get("page") === "2" ? [repo(101)] : Array.from({ length: 100 }, (_, i) => repo(i + 1)));
    }
    return json({ ...user, login: u.pathname.split("/").pop() });
  } });
  const result = await api.fetchLeaderboard("token");
  assert.equal(result.length, 101);
  assert.equal(result.filter((entry) => entry.isViewer).length, 1);
  assert.ok(result.every((entry) => entry.totalStars === 101 && entry.totalForks === 202));
});

test("leaderboard fails instead of returning a misleading partial ranking", async () => {
  const api = loadModule("website/src/lib/leaderboard.ts", { fetch: async (url) => {
    if (url.includes("/repos")) return json({ message: "rate limit exceeded" }, 429);
    return json(user);
  } });
  await assert.rejects(api.fetchAllUsers(["octo"], "token", "octo"), (error) => error.kind === "rate-limit");
});

test("average and weekend calculations ignore duplicates/future dates and use actual dates", () => {
  const api = loadModule("website/src/lib/analytics.ts");
  const data = calendar([
    day("2026-09-18", 2), day("2026-09-19", 4), day("2026-09-19", 4),
    day("2026-09-17", 0), day("2026-09-20", 100),
  ]);
  data.weeks[0].contributionDays[1].weekday = 1;
  data.weeks[0].contributionDays[2].weekday = 1;
  assert.equal(api.computeAvgPerDay(data), 3);
  assert.equal(api.computeWeekendPct(data), 67);
});

test("malformed optional traffic never poisons aggregate totals", async () => {
  const base = dashboardFetch({ forbiddenClones: false });
  const api = loadModule("website/src/lib/dashboard.ts", { fetch: async (url, init) =>
    url.endsWith("/traffic/views") ? json({ views: [], count: null, uniques: "bad" }) : base(url, init),
  });
  const result = await api.fetchDashboardData("token");
  assert.equal(result.repos[0].totalViews, null);
  assert.equal(result.trafficCoverage.views, 0);
  assert.equal(result.totalClones, 2);
});

test("primary or secondary rate limits stop subsequent repository pages", async () => {
  let requests = 0;
  const api = loadModule("website/src/lib/http.ts", { fetch: async () => {
    requests++;
    return requests === 1 ? json(Array.from({ length: 100 }, (_, i) => ({ id: i })))
      : json({ message: "secondary rate limit" }, 403, { "retry-after": "1" });
  } });
  const client = api.createGitHubClient("token");
  await assert.rejects(client.paginate("/user/repos", (item) => String(item.id)), (error) => error.kind === "rate-limit");
  await assert.rejects(client.request("/user"), (error) => error.kind === "rate-limit");
  assert.equal(requests, 2);
});

test("timeout and in-flight cancellation retain their error identity", async () => {
  const stalled = (_url, { signal }) => new Promise((_resolve, reject) =>
    signal.addEventListener("abort", () => reject(signal.reason), { once: true }));
  const api = loadModule("website/src/lib/github.ts", { fetch: stalled });
  await assert.rejects(api.fetchPublicProfile("octo"), (error) => error.kind === "timeout");
  const controller = new AbortController();
  const request = api.fetchPublicProfile("octo", controller.signal);
  controller.abort();
  await assert.rejects(request, { name: "AbortError" });
});

test("REST follows Link pages even when a page is short and prevents pagination loops", async () => {
  const api = loadModule("website/src/lib/http.ts", { fetch: async (url) =>
    new URL(url).searchParams.get("page") === "2"
      ? json([{ id: 2 }])
      : json([{ id: 1 }], 200, { link: '<https://api.github.com/user/repos?page=2>; rel="next"' }),
  });
  const all = await api.createGitHubClient().paginate("/user/repos", (item) => String(item.id));
  assert.equal(all.length, 2);
  const loop = loadModule("website/src/lib/http.ts", { fetch: async (url) =>
    json([{ id: 1 }], 200, { link: `<${url}>; rel="next"` }),
  });
  await assert.rejects(loop.createGitHubClient().paginate("/user/repos"), /pagination/i);
});

test("successful optional statistics survive another statistic's network failure", async () => {
  const base = dashboardFetch({ forbiddenClones: false });
  const api = loadModule("website/src/lib/dashboard.ts", { fetch: async (url, init) => {
    if (url.endsWith("/stats/commit_activity")) throw new TypeError("connection lost");
    return base(url, init);
  } });
  const result = await api.fetchRepoDetail("octo", "repo-1", "token");
  assert.equal(result.participation.all[0], 2);
  assert.equal(result.statisticsPending, false);
  assert.ok(result.warnings.some((warning) => /commit activity/i.test(warning)));
});

test("GraphQL errors with partial data are rejected and rate errors are classified", async () => {
  for (const type of ["RATE_LIMITED", "INTERNAL"]) {
    const api = loadModule("website/src/lib/http.ts", { fetch: async () =>
      json({ data: { user: { login: "octo" } }, errors: [{ type, message: type }] }),
    });
    await assert.rejects(api.createGitHubClient("token").graphql("query {}", {}),
      (error) => error.kind === (type === "RATE_LIMITED" ? "rate-limit" : "graphql"));
  }
});

test("dashboard stops later traffic batches after rate limit while retaining repos", async () => {
  let trafficRequests = 0;
  const base = dashboardFetch({ reposCount: 12, rateTraffic: true });
  const api = loadModule("website/src/lib/dashboard.ts", { fetch: async (url, init) => {
    if (url.includes("/traffic/")) trafficRequests++;
    return base(url, init);
  } });
  const result = await api.fetchDashboardData("token");
  assert.equal(result.repos.length, 12);
  assert.equal(result.trafficCoverage.views, 0);
  assert.equal(result.repos[11].totalViews, null);
  assert.ok(trafficRequests <= 15);
});

test("malformed statistics are unavailable rather than crashing detail charts", async () => {
  const base = dashboardFetch();
  const api = loadModule("website/src/lib/dashboard.ts", { fetch: async (url, init) => {
    if (url.endsWith("/stats/commit_activity")) return json([{}]);
    if (url.endsWith("/stats/participation")) return json({ all: ["bad"], owner: [1] });
    return base(url, init);
  } });
  const result = await api.fetchRepoDetail("octo", "repo-1", "token");
  assert.equal(result.commitActivity.length, 0);
  assert.equal(result.participation, null);
  assert.equal(result.statisticsPending, false);
  assert.ok(result.warnings.some((warning) => /statistics/i.test(warning)));
});

test("pending statistics can become available on a bounded retry", async () => {
  let attempts = 0;
  const base = dashboardFetch({ forbiddenClones: false });
  const api = loadModule("website/src/lib/dashboard.ts", { fetch: async (url, init) => {
    if (url.endsWith("/stats/commit_activity")) {
      attempts++;
      return attempts === 1 ? json({}, 202) : json([{ week: 1, total: 1, days: [1, 0, 0, 0, 0, 0, 0] }]);
    }
    return base(url, init);
  } });
  const result = await api.fetchRepoDetail("octo", "repo-1", "token");
  assert.equal(result.commitActivity[0].total, 1);
  assert.equal(result.statisticsPending, false);
  assert.equal(attempts, 2);
});

test("GraphQL non-advancing cursors and conflicting calendar duplicates fail closed", async () => {
  const base = graphFetch();
  const repeating = loadModule("website/src/lib/github.ts", { fetch: async (url, init) => {
    const body = await (await base(url, init)).json();
    if (body.data.user.repositories) body.data.user.repositories.pageInfo = { hasNextPage: true, endCursor: "same" };
    return json(body);
  } });
  await assert.rejects(repeating.fetchFullProfile("octo", "token"), /pagination/i);
  const conflicting = loadModule("website/src/lib/github.ts", { fetch: async (url, init) => {
    const body = await (await base(url, init)).json();
    const collection = body.data.user.contributionsCollection;
    if (collection) {
      const days = collection.contributionCalendar.weeks[0].contributionDays;
      days.push({ ...days[0], contributionCount: 42 });
    }
    return json(body);
  } });
  await assert.rejects(conflicting.fetchFullProfile("octo", "token"), /contribution/i);
});

test("a pagination header cannot forward the token to another origin", async () => {
  let requests = 0;
  const api = loadModule("website/src/lib/http.ts", { fetch: async () => {
    requests++;
    return json([{ id: 1 }], 200, { link: '<https://example.com/user/repos?page=2>; rel="next"' });
  } });
  await assert.rejects(api.createGitHubClient("token").paginate("/user/repos"), /pagination/i);
  assert.equal(requests, 1);
});

test("empty GraphQL payloads produce a classified error", async () => {
  const api = loadModule("website/src/lib/http.ts", { fetch: async () => json(null) });
  await assert.rejects(api.createGitHubClient().graphql("query {}", {}), (error) => error.kind === "invalid-response");
});
