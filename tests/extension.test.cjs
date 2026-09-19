const test = require("node:test");
const assert = require("node:assert/strict");
const { loadModule: loadWithGlobals } = require("./helpers.cjs");

const NOW = "2026-09-19T12:00:00.000Z";
class FixedDate extends Date {
  constructor(...args) { super(...(args.length ? args : [NOW])); }
  static now() { return Date.parse(NOW); }
}
function loadModule(file, globals = {}) {
  return loadWithGlobals(file, { Date: FixedDate, ...globals });
}
function eventTarget() {
  const listeners = {};
  return {
    addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
    dispatch(type, event = {}) { for (const fn of listeners[type] || []) fn(event); },
  };
}
function chromeMock(handler = () => null, local = { ghToken: "alice-token" }, sync = {}) {
  const listeners = [];
  let backgroundListener;
  const chrome = {
    runtime: {
      lastError: null,
      onMessage: { addListener(listener) { backgroundListener = listener; } },
      sendMessage(message, callback) {
        if (message.type === "GPI_AUTH") {
          backgroundListener(message, { id: "gitscope-test" }, callback);
          return;
        }
        Promise.resolve().then(() => handler(message)).then(callback);
      },
    },
    storage: { onChanged: { addListener(fn) { listeners.push(fn); } } },
  };
  for (const [area, values] of Object.entries({ local, sync })) {
    chrome.storage[area] = {
      get(keys, cb) {
        queueMicrotask(() => cb(keys === null ? { ...values } :
          Object.fromEntries(keys.filter(k => k in values).map(k => [k, values[k]]))));
      },
      set(entries, cb) {
        const changes = {};
        for (const [key, value] of Object.entries(entries)) {
          changes[key] = { oldValue: values[key], newValue: value };
          values[key] = value;
        }
        queueMicrotask(() => {
          for (const fn of listeners) fn(changes, area);
          cb?.();
        });
      },
      remove(keys, cb) {
        const changes = {};
        for (const key of Array.isArray(keys) ? keys : [keys]) {
          if (key in values) changes[key] = { oldValue: values[key] };
          delete values[key];
        }
        queueMicrotask(() => {
          if (Object.keys(changes).length) for (const fn of listeners) fn(changes, area);
          cb?.();
        });
      },
    };
  }
  // Token clients from separate VM contexts share one real service-worker queue.
  loadModule("src/js/background.js", { chrome });
  return { chrome, local, sync };
}
function day(date, contributionCount = 1) {
  return { date, contributionCount, weekday: new Date(`${date}T00:00:00Z`).getUTCDay() };
}
function calendar(days) {
  const weeks = [];
  for (const d of days) {
    if (!weeks.length || d.weekday === 0) weeks.push({ contributionDays: [] });
    weeks.at(-1).contributionDays.push(d);
  }
  return { totalContributions: days.reduce((s, d) => s + d.contributionCount, 0), weeks };
}
function contributions(variables, count = 1) {
  const days = [];
  const start = new Date(variables.from.slice(0, 10));
  const end = new Date(variables.to.slice(0, 10));
  for (let t = +start; t <= +end; t += 86400000) days.push(day(new Date(t).toISOString().slice(0, 10), count));
  return {
    totalCommitContributions: days.length * count,
    totalPullRequestContributions: 0, totalPullRequestReviewContributions: 0,
    totalIssueContributions: 0, totalRepositoryContributions: 0,
    contributionCalendar: calendar(days),
  };
}
function repo(name, stars = 1) {
  return {
    name, url: `https://github.com/alice/${name}`, stargazerCount: stars, forkCount: 1,
    primaryLanguage: { name: "JavaScript", color: "#f1e05a" },
    createdAt: "2020-01-01", updatedAt: NOW, isArchived: false, isFork: false,
  };
}
function profile(login, nodes = [repo("one")], hasNextPage = false) {
  return {
    login, name: login, createdAt: "2020-01-01", avatarUrl: "",
    followers: { totalCount: 5 }, following: { totalCount: 2 },
    repositories: { nodes, totalCount: nodes.length, pageInfo: { hasNextPage, endCursor: hasNextPage ? "page2" : null } },
    pullRequests: { totalCount: 10 }, openPRs: { totalCount: 1 }, closedPRs: { totalCount: 1 },
    issues: { totalCount: 2 }, closedIssues: { totalCount: 1 }, openIssues: { totalCount: 1 },
    starredRepositories: { totalCount: 1 }, gists: { totalCount: 1 },
    repositoriesContributedTo: { totalCount: 1 }, organizations: { totalCount: 1 },
  };
}
function responder(message) {
  if (message.query.includes("viewer")) return { viewer: { login: "alice" } };
  if (message.query.includes("contributionsCollection")) {
    return { user: { contributionsCollection: contributions(message.variables) } };
  }
  return { user: profile(message.variables.username) };
}
const settle = async () => { for (let i = 0; i < 15; i++) await new Promise(r => setTimeout(r, 5)); };
function deferred() {
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  return { promise, resolve };
}

test("repository pagination includes all pages and deduplicates cursor boundaries", async () => {
  const calls = [];
  const { chrome } = chromeMock(m => {
    calls.push(m);
    if (m.query.includes("contributionsCollection")) return responder(m);
    const p = profile("alice", m.variables.after ? [repo("two"), repo("three", 9)] : [repo("one"), repo("two")], !m.variables.after);
    p.repositories.totalCount = 3;
    return { user: p };
  });
  const { fetchProfileInsights } = loadModule("src/js/api.js", { chrome });
  const data = await fetchProfileInsights("alice", "alice-token");
  assert.equal(data.user.repositories.nodes.length, 3);
  assert.equal(data.user.repositories.nodes.reduce((s, r) => s + r.stargazerCount, 0), 11);
  assert.equal(calls.filter(m => m.variables.after === "page2").length, 1);
});

test("a failed contribution window rejects and never caches partial zeros", async () => {
  let fail = true;
  let windows = 0;
  const { chrome } = chromeMock(m => {
    if (m.query.includes("contributionsCollection") && ++windows % 4 === 2 && fail) return null;
    return responder(m);
  });
  const api = loadModule("src/js/api.js", { chrome });
  await assert.rejects(api.fetchProfileInsights("alice", "alice-token"));
  fail = false;
  const result = await api.fetchProfileInsights("alice", "alice-token");
  assert.equal(result.user.contributionsCollection.contributionCalendar.totalContributions, 365);
  assert.ok(windows >= 8);
});

test("rolling 365 windows cover whole UTC dates once, including category totals", async () => {
  const { chrome } = chromeMock(responder);
  const api = loadModule("src/js/api.js", { chrome });
  const cc = (await api.fetchProfileInsights("alice", "alice-token")).user.contributionsCollection;
  assert.equal(cc.contributionCalendar.totalContributions, 365);
  assert.equal(cc.totalCommitContributions, 365);
});

test("simultaneous profile requests share work but different accounts do not share cache", async () => {
  let coreCalls = 0;
  const mock = chromeMock(m => {
    if (!m.query.includes("contributionsCollection")) coreCalls++;
    const result = responder(m);
    if (result.user?.login) result.user.name = m.token;
    return result;
  });
  const api = loadModule("src/js/api.js", { chrome: mock.chrome });
  await Promise.all([api.fetchProfileInsights("ALICE", "alice-token"), api.fetchProfileInsights("alice", "alice-token")]);
  assert.equal(coreCalls, 1);
  const storage = loadModule("src/js/storage.js", { chrome: mock.chrome });
  await storage.saveToken("bob-token");
  const data = await api.fetchProfileInsights("alice", "bob-token");
  assert.equal(data.user.name, "bob-token");
});

test("token migrates to local; saving and clearing invalidate viewer and profile caches", async () => {
  const mock = chromeMock(responder, {
    gpi_profile_alice: { data: "private", timestamp: Date.parse(NOW) },
    gpi_viewer_stats: { login: "old" },
  }, { ghToken: "legacy-token" });
  const storage = loadModule("src/js/storage.js", { chrome: mock.chrome });
  assert.equal(await storage.getSavedToken(), "legacy-token");
  assert.equal(mock.local.ghToken, "legacy-token");
  await settle();
  assert.equal(mock.sync.ghToken, undefined);
  await storage.saveToken("new-token");
  assert.equal(await storage.getViewerStats("new-token"), null);
  assert.equal(mock.local.gpi_profile_alice, undefined);
  await storage.clearSavedToken();
  assert.equal(await storage.getSavedToken(), null);
  assert.equal(mock.sync.ghToken, undefined);
});

test("expired cache entries are removed and auth storage failures reject", async () => {
  const mock = chromeMock(responder, { expired: { data: 4, timestamp: Date.parse(NOW) - 300001 } });
  const storage = loadModule("src/js/storage.js", { chrome: mock.chrome });
  assert.equal(await storage.getCached("expired"), null);
  assert.equal(mock.local.expired, undefined);
  const writeLocal = mock.chrome.storage.local.set;
  mock.chrome.storage.local.set = (_entries, cb) => {
    mock.chrome.runtime.lastError = { message: "disk full" };
    cb();
    mock.chrome.runtime.lastError = null;
  };
  await assert.rejects(storage.saveToken("cannot-save"), /disk full/);
  mock.chrome.storage.local.set = writeLocal;
  await storage.saveToken("recovered-token");
  assert.equal(await storage.getSavedToken(), "recovered-token");
});

test("current streak skips only today and longest streak requires adjacent dates", () => {
  const charts = loadModule("src/js/charts.js");
  assert.equal(charts.computeStreaks(calendar([day("2026-09-16"), day("2026-09-17"), day("2026-09-18", 0), day("2026-09-19", 0)])).currentStreak, 0);
  assert.equal(charts.computeStreaks(calendar([day("2026-09-17"), day("2026-09-18"), day("2026-09-19", 0)])).currentStreak, 2);
  const gaps = charts.computeStreaks(calendar([day("2026-09-15"), day("2026-09-17"), day("2026-09-18")]));
  assert.equal(gaps.longestStreak, 2);
  assert.equal(gaps.currentStreak, 2);
});

test("velocity compares 28 complete days with preceding 28 despite partial weeks", () => {
  const days = [];
  for (let i = 56; i >= 0; i--) {
    const date = new Date(Date.parse("2026-09-19") - i * 86400000).toISOString().slice(0, 10);
    days.push(day(date, i === 0 ? 10000 : i <= 28 ? 2 : 1));
  }
  const charts = loadModule("src/js/charts.js");
  const result = charts.computeVelocity(calendar(days));
  assert.equal(result.ratio, 2);
  assert.equal(result.trend, "up");
  assert.equal(charts.computeAvgPerDay(calendar([day("2026-09-17", 2), day("2026-09-18", 0)])), 2);
});

// A small DOM boundary double: real content, storage, API, chart and dashboard
// modules run together, while browser events and element insertion are controlled.
function dom() {
  let document;
  class Element {
    constructor(tag) {
      Object.assign(this, eventTarget(), { tagName: tag, children: [], style: {}, attributes: {}, className: "", innerHTML: "", textContent: "" });
      this.classList = {
        add: name => { this.className += ` ${name}`; },
        contains: name => this.className.split(" ").includes(name),
      };
    }
    appendChild(child) { child.remove(); child.parentNode = this; this.children.push(child); return child; }
    append(...children) { children.forEach(child => this.appendChild(child)); }
    get parentElement() { return this.parentNode; }
    get nextSibling() { return this.parentNode?.children[this.parentNode.children.indexOf(this) + 1] || null; }
    get isConnected() { return this === document.body || Boolean(this.parentNode?.isConnected); }
    insertBefore(child, sibling) {
      if (!sibling) return this.appendChild(child);
      child.remove(); child.parentNode = this;
      this.children.splice(this.children.indexOf(sibling), 0, child);
      return child;
    }
    remove() {
      if (this.parentNode) this.parentNode.children.splice(this.parentNode.children.indexOf(this), 1);
      this.parentNode = null;
    }
    setAttribute(key, value) { this.attributes[key] = String(value); if (key === "class") this.className = value; }
    getAttribute(key) { return this.attributes[key] ?? null; }
    focus() { document.activeElement = this; this.dispatch("focus"); }
    closest(selector) { return this.classList.contains(selector.slice(1)) ? this : this.parentNode?.closest(selector); }
    querySelector(selector) { return find(this, e => selector[0] === "#" ? e.id === selector.slice(1) : e.classList.contains(selector.slice(1))); }
    querySelectorAll(selector) { return all(this).filter(e => e.classList.contains(selector.slice(1))); }
    contains(child) { return all(this).includes(child); }
  }
  const all = node => node.children.flatMap(child => [child, ...all(child)]);
  const find = (node, predicate) => all(node).find(predicate) || null;
  document = Object.assign(eventTarget(), {
    createElement: tag => new Element(tag), createElementNS: (_ns, tag) => new Element(tag),
    getElementById: id => find(document.body, e => e.id === id),
    querySelector(selector) {
      if (selector === ".Layout-sidebar .h-card") return find(document.body, e => e.classList.contains("h-card"));
      if (selector === '[itemtype="http://schema.org/Person"]') return find(document.body, e => e.attributes.itemtype === "http://schema.org/Person");
      return document.body.querySelector(selector);
    },
    querySelectorAll: selector => document.body.querySelectorAll(selector),
  });
  document.body = new Element("body");
  document.documentElement = document.body;
  const sidebar = new Element("aside"); sidebar.className = "Layout-sidebar";
  const card = new Element("div"); card.className = "h-card";
  sidebar.appendChild(card); document.body.appendChild(sidebar);
  const window = Object.assign(eventTarget(), { location: { pathname: "/bob", href: "https://github.com/bob" } });
  const observers = [];
  class MutationObserver {
    constructor(fn) { this.fn = fn; }
    observe() { observers.push(this); }
    disconnect() { const i = observers.indexOf(this); if (i >= 0) observers.splice(i, 1); }
  }
  return {
    document, window, MutationObserver, sidebar, card,
    mutate() { for (const o of [...observers]) o.fn([]); },
    navigate(username) {
      window.location.pathname = `/${username}`; window.location.href = `https://github.com/${username}`;
      document.dispatch("turbo:load");
    },
    text(node = document.body) { return [node.innerHTML, node.textContent, ...node.children.map(c => this.text(c))].join(" "); },
  };
}

test("first visit to another profile queries authenticated viewer and compares correct stats", async () => {
  const browser = dom();
  const calls = [];
  const mock = chromeMock(m => { calls.push(m); return responder(m); }, { ghToken: "alice-token" }, { ghToken: "alice-token" });
  loadModule("src/js/content.js", { ...browser, chrome: mock.chrome });
  await settle();
  assert.match(browser.text(), /vs\. You \(alice\)/);
  assert.ok(calls.some(m => m.query.includes("viewer")));
  assert.ok(calls.some(m => m.variables?.username === "alice"));
});

test("late profile responses cannot overwrite a newer route; duplicate initialization coalesces", async () => {
  const browser = dom();
  const gate = deferred();
  let bobCalls = 0;
  const mock = chromeMock(m => {
    if (m.variables?.username === "bob" && !m.query.includes("contributionsCollection")) { bobCalls++; return gate.promise; }
    return responder(m);
  }, { ghToken: "alice-token" }, { ghToken: "alice-token" });
  loadModule("src/js/content.js", { ...browser, chrome: mock.chrome });
  browser.document.dispatch("turbo:load");
  await settle();
  browser.navigate("carol");
  await new Promise(r => setTimeout(r, 350));
  gate.resolve({ user: profile("bob") });
  await settle();
  const panel = browser.document.getElementById("gpi-panel");
  assert.equal(panel?.getAttribute("data-profile"), "carol");
  assert.equal(bobCalls, 1);
  assert.equal(browser.document.querySelectorAll(".gpi-container").length, 1);
});

test("missing sidebar retries when ready and sidebar-only fallback inserts inside sidebar", async () => {
  const browser = dom();
  browser.sidebar.remove();
  const mock = chromeMock(responder);
  loadModule("src/js/content.js", { ...browser, chrome: mock.chrome });
  await settle();
  browser.card.remove();
  browser.document.body.appendChild(browser.sidebar);
  browser.mutate();
  await settle();
  const panel = browser.document.getElementById("gpi-panel");
  assert.ok(panel);
  assert.equal(panel.parentElement.parentElement, browser.sidebar);
});

test("chart data is keyboard reachable and loading/error states announce status", () => {
  const browser = dom();
  const charts = loadModule("src/js/charts.js", browser);
  const heatmap = charts.renderMiniHeatmap(calendar([day("2026-09-18", 2), day("2026-09-19", 0)]));
  const cells = heatmap.querySelectorAll(".gpi-heatmap-cell");
  assert.equal(cells[0].getAttribute("tabindex"), "0");
  assert.match(cells[0].getAttribute("aria-label"), /2026-09-18.*2 contributions/);
  cells[0].dispatch("keydown", { key: "ArrowRight", preventDefault() {} });
  assert.equal(browser.document.activeElement, cells[1]);
  const dashboard = loadModule("src/js/dashboard.js", browser);
  dashboard.showLoadingSkeleton();
  assert.equal(browser.document.getElementById("gpi-panel").getAttribute("role"), "status");
  dashboard.showErrorState("bob");
  assert.equal(browser.document.getElementById("gpi-panel").getAttribute("role"), "alert");
});

test("incomplete or conflicting contribution calendars reject instead of caching misleading totals", async () => {
  for (const corrupt of [
    cc => { cc.contributionCalendar.weeks = []; },
    cc => { cc.contributionCalendar.weeks[0].contributionDays[0].contributionCount = -1; },
    cc => {
      const days = cc.contributionCalendar.weeks[0].contributionDays;
      days.push({ ...days[0], contributionCount: 999 });
    },
  ]) {
    const mock = chromeMock(m => {
      const result = responder(m);
      if (result.user?.contributionsCollection) corrupt(result.user.contributionsCollection);
      return result;
    });
    const api = loadModule("src/js/api.js", { chrome: mock.chrome });
    await assert.rejects(api.fetchProfileInsights("alice", "alice-token"));
    assert.equal(Object.keys(mock.local).filter(k => k.includes("_profile_")).length, 0);
  }
});

test("truncated repository pagination fails rather than saving an incomplete aggregate", async () => {
  const mock = chromeMock(m => {
    const result = responder(m);
    if (result.user?.repositories) result.user.repositories.totalCount = 150;
    return result;
  });
  const api = loadModule("src/js/api.js", { chrome: mock.chrome });
  await assert.rejects(api.fetchProfileInsights("alice", "alice-token"), /repository/i);
});

test("background propagates GraphQL errors even when partial data exists", async () => {
  let listener;
  const chrome = { runtime: { onMessage: { addListener(fn) { listener = fn; } } } };
  loadModule("src/js/background.js", {
    chrome, console: { error() {} },
    fetch: async () => ({
      ok: true,
      json: async () => ({ data: { user: { login: "alice" } }, errors: [{ message: "query budget" }] }),
    }),
  });
  const result = await new Promise(resolve => listener({ type: "GPI_GRAPHQL", token: "t", query: "query {}" }, {}, resolve));
  assert.ok(result.errors);
  assert.equal(result.user, undefined);
});

test("a response from a revoked session cannot populate caches or viewer identity", async () => {
  const gate = deferred();
  const mock = chromeMock(m => m.query.includes("viewer") ? gate.promise : responder(m));
  const api = loadModule("src/js/api.js", { chrome: mock.chrome });
  const pending = api.fetchAuthenticatedViewer("alice-token");
  const rejection = assert.rejects(pending, /Authentication changed/);
  await settle();
  const storage = loadModule("src/js/storage.js", { chrome: mock.chrome });
  await storage.saveToken("bob-token");
  gate.resolve({ viewer: { login: "alice" } });
  await rejection;
  assert.equal(Object.keys(mock.local).filter(k => k.endsWith("_viewer")).length, 0);
});

test("same token sign-in rotates the session and expires cached viewer statistics", async () => {
  const mock = chromeMock(responder);
  const storage = loadModule("src/js/storage.js", { chrome: mock.chrome });
  await storage.saveViewerStats({ login: "alice" }, "alice-token");
  assert.equal((await storage.getViewerStats("alice-token")).login, "alice");
  await storage.saveToken("alice-token");
  assert.equal(await storage.getViewerStats("alice-token"), null);
  await storage.saveViewerStats({ login: "alice" }, "alice-token");
  const key = Object.keys(mock.local).find(k => k.endsWith("_viewer_stats"));
  mock.local[key].timestamp -= 300001;
  assert.equal(await storage.getViewerStats("alice-token"), null);
  assert.equal(mock.local[key], undefined);
});

test("sign-out cannot resurrect a synced token after sync storage fails", async () => {
  const mock = chromeMock(responder, { ghToken: "alice-token" }, { ghToken: "old-synced-token" });
  const storage = loadModule("src/js/storage.js", { chrome: mock.chrome });
  mock.chrome.storage.sync.remove = (_keys, cb) => {
    mock.chrome.runtime.lastError = { message: "sync unavailable" };
    cb();
    mock.chrome.runtime.lastError = null;
  };
  await storage.clearSavedToken();
  await settle();
  assert.equal(await storage.getSavedToken(), null);
});

test("legacy token migration initializes a live profile once and duplicate script loads do not duplicate UI", async () => {
  const browser = dom();
  let calls = 0;
  const mock = chromeMock(m => { if (m.query.includes("ProfileCore")) calls++; return responder(m); }, {}, { ghToken: "alice-token" });
  loadModule("src/js/content.js", { ...browser, chrome: mock.chrome });
  loadModule("src/js/content.js", { ...browser, chrome: mock.chrome });
  await settle();
  assert.match(browser.text(), /vs\. You \(alice\)/);
  assert.equal(calls, 2); // Bob plus the authenticated viewer.
  assert.equal(browser.document.querySelectorAll(".gpi-container").length, 1);
});

test("leaving a profile removes the panel and ignores any late response", async () => {
  const browser = dom();
  const gate = deferred();
  const mock = chromeMock(m => m.variables?.username === "bob" ? gate.promise : responder(m));
  loadModule("src/js/content.js", { ...browser, chrome: mock.chrome });
  await settle();
  browser.navigate("bob/repository");
  gate.resolve({ user: profile("bob") });
  await settle();
  assert.equal(Boolean(browser.document.getElementById("gpi-panel")), false);
});

test("extension and website streak/velocity semantics agree for duplicates, gaps and future padding", () => {
  const charts = loadModule("src/js/charts.js");
  const website = loadModule("website/src/lib/analytics.ts");
  const fixture = calendar([
    day("2026-09-15", 4), day("2026-09-17", 2), day("2026-09-18", 3),
    day("2026-09-18", 0), day("2026-09-19", 0), day("2026-09-20", 4),
  ]);
  const a = charts.computeStreaks(fixture);
  const b = website.computeStreaks(fixture);
  assert.equal(a.currentStreak, b.currentStreak);
  assert.equal(a.longestStreak, b.longestStreak);
  assert.equal(charts.computeVelocity(fixture).ratio, website.computeVelocity(fixture).ratio);
});

test("Turbo navigation does not remount the old profile while the next document is loading", async () => {
  const browser = dom();
  const mock = chromeMock(responder);
  loadModule("src/js/content.js", { ...browser, chrome: mock.chrome });
  await settle();
  assert.ok(browser.document.getElementById("gpi-panel"));
  browser.document.dispatch("turbo:before-visit");
  browser.mutate();
  await settle();
  assert.equal(Boolean(browser.document.getElementById("gpi-panel")), false);
  browser.navigate("carol");
  await settle();
  assert.equal(browser.document.getElementById("gpi-panel")?.getAttribute("data-profile"), "carol");
});

test("a delayed legacy migration cannot overwrite a newer login or resurrect a signed-out session", async () => {
  for (const signOut of [false, true]) {
    const mock = chromeMock(responder, {}, { ghToken: "old-token" });
    let release;
    mock.chrome.storage.sync.get = (_keys, callback) => { release = () => callback({ ghToken: "old-token" }); };
    const storage = loadModule("src/js/storage.js", { chrome: mock.chrome });
    const pending = storage.getSavedToken();
    await settle();
    const popup = loadModule("src/js/storage.js", { chrome: mock.chrome });
    const change = signOut ? popup.clearSavedToken() : popup.saveToken("new-token");
    release();
    await Promise.all([pending, change]);
    assert.equal(await storage.getSavedToken(), signOut ? null : "new-token");
  }
});

test("token reads begun after an account change do not reuse an older pending read", async () => {
  const mock = chromeMock(responder, { ghToken: "alice-token" }, { ghToken: "legacy-token" });
  let release;
  mock.chrome.storage.sync.remove = (_keys, callback) => {
    if (!release) release = callback;
    else callback();
  };
  const storage = loadModule("src/js/storage.js", { chrome: mock.chrome });
  const pending = storage.getSavedToken();
  await settle();
  await storage.saveToken("new-token");
  const afterChange = storage.getSavedToken();
  release();
  await pending;
  assert.equal(await afterChange, "new-token");
});

for (const signOut of [false, true]) {
  test(`final migration read is serialized with a popup ${signOut ? "sign-out" : "new login"}`, async () => {
    const mock = chromeMock(responder, {}, { ghToken: "legacy-token" });
    const readLocal = mock.chrome.storage.local.get;
    let authReads = 0;
    let release;
    mock.chrome.storage.local.get = (keys, callback) => {
      if (keys?.includes("ghToken") && ++authReads === 2) {
        // Capture the final pre-migration read while local is still empty,
        // then delay delivery until a different context requests an auth change.
        readLocal(keys, snapshot => { release = () => callback(snapshot); });
      } else readLocal(keys, callback);
    };
    const content = loadModule("src/js/storage.js", { chrome: mock.chrome });
    const popup = loadModule("src/js/storage.js", { chrome: mock.chrome });
    const migration = content.getSavedToken();
    await settle();
    assert.equal(typeof release, "function");
    let changeFinished = false;
    const change = (signOut ? popup.clearSavedToken() : popup.saveToken("new-token"))
      .then(() => { changeFinished = true; });
    await settle();
    const changedBeforeRelease = changeFinished;
    release();
    await Promise.all([migration, change]);
    assert.equal(await content.getSavedToken(), signOut ? null : "new-token");
    assert.equal(changedBeforeRelease, false, "auth writes must wait for the outstanding migration read");
  });
}

test("valid local token reads survive sync cleanup failure without repeated sync writes", async () => {
  const mock = chromeMock(responder, { ghToken: "alice-token" }, { ghToken: "legacy-token" });
  let removals = 0;
  mock.chrome.storage.sync.remove = (_keys, callback) => {
    removals++;
    mock.chrome.runtime.lastError = { message: "sync unavailable" };
    callback();
    mock.chrome.runtime.lastError = null;
  };
  const content = loadModule("src/js/storage.js", { chrome: mock.chrome });
  const popup = loadModule("src/js/storage.js", { chrome: mock.chrome });
  for (const client of [content, popup, content]) {
    assert.equal(await client.getSavedToken(), "alice-token");
    await settle();
  }
  assert.equal(removals, 1);
});

test("slow legacy cleanup cannot block local-token reads, saves or clears", async () => {
  const mock = chromeMock(responder, { ghToken: "alice-token" }, { ghToken: "legacy-token" });
  let release;
  mock.chrome.storage.sync.remove = (_keys, callback) => { release = callback; };
  const storage = loadModule("src/js/storage.js", { chrome: mock.chrome });
  let readCompleted = false;
  const read = storage.getSavedToken().then(token => { readCompleted = true; return token; });
  await settle();
  try {
    assert.equal(readCompleted, true);
    assert.equal(await read, "alice-token");
    await storage.saveToken("new-token");
    assert.equal(await storage.getSavedToken(), "new-token");
    await storage.clearSavedToken();
    assert.equal(await storage.getSavedToken(), null);
  } finally {
    release();
  }
});

test("a later listener cancelling Turbo navigation keeps the panel and controller active", async () => {
  const browser = dom();
  const mock = chromeMock(responder);
  loadModule("src/js/content.js", { ...browser, chrome: mock.chrome });
  await settle();
  const panel = browser.document.getElementById("gpi-panel");
  browser.document.addEventListener("turbo:before-visit", event => event.preventDefault());
  browser.document.dispatch("turbo:before-visit", {
    defaultPrevented: false,
    preventDefault() { this.defaultPrevented = true; },
  });
  browser.mutate();
  await settle();
  assert.ok(browser.document.getElementById("gpi-panel") === panel, "cancelled navigation should retain its panel");
  const storage = loadModule("src/js/storage.js", { chrome: mock.chrome });
  await storage.clearSavedToken();
  await settle();
  assert.match(browser.text(), /Sign in via the extension popup/);
});
