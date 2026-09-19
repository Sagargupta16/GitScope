const test = require("node:test");
const assert = require("node:assert/strict");
const { build } = require("esbuild");
const vm = require("node:vm");
const path = require("node:path");
const { createRequire } = require("node:module");
const { memoryStorage, loadModule } = require("./helpers.cjs");

// Run the real page/effect code with controlled hooks and deferred API responses.
// Layout and browser event behavior are covered separately by browser checks.
const compiled = new Map();
async function pageHarness(file, options = {}) {
  const filename = path.resolve(__dirname, "..", "website/src", file);
  if (!compiled.has(file)) {
    const mocks = {
      react: `export const useState=(...a)=>__h.useState(...a);
        export const useId=()=>__h.useRef("test-id").current;
        export const useRef=(...a)=>__h.useRef(...a);
        export const useEffect=(...a)=>__h.useEffect(...a);
        export const useCallback=(...a)=>__h.useCallback(...a);`,
      auth: `export const useAuth=()=>__h.auth;
        export const getAuthSessionId=()=>__h.session;
        export const getStoredToken=()=>__h.auth.token;
        export const getStoredLogin=()=>__h.auth.login;
        export const getLoginUrl=(options)=>"https://auth.example/login?return_to="+options.returnTo;
        export const retryAuth=()=>__h.retryAuth();
        export const beginLogin=(options)=>__h.beginLogin(options);`,
      router: `export const useSearchParams=()=>[__h.query, (value)=>{__h.query=new URLSearchParams(value);__h.dirty=true;}];
        export const useParams=()=>__h.params;
        export const useLocation=()=>__h.location;
        export const useNavigate=()=>__h.navigate;
        export const Link="a";`,
      api: `export const fetchDashboardData=(...a)=>__h.api.fetchDashboardData(...a);
        export const fetchRepoDetail=(...a)=>__h.api.fetchRepoDetail(...a);
        export const fetchPublicProfile=(...a)=>__h.api.fetchPublicProfile(...a);
        export const fetchFullProfile=(...a)=>__h.api.fetchFullProfile(...a);
        export const fetchFollowing=(...a)=>__h.api.fetchFollowing(...a);
        export const fetchAllUsers=(...a)=>__h.api.fetchAllUsers(...a);`,
    };
    const result = await build({
      entryPoints: [filename], bundle: true, write: false, platform: "node",
      format: "cjs", packages: "external", logLevel: "silent",
      plugins: [{
        name: "controlled-ui-boundaries",
        setup(builder) {
          builder.onResolve({ filter: /^(react|react-router)$|\/lib\/(auth|github|dashboard|leaderboard)$/ }, ({ path: source }) => ({
            path: source === "react" ? "react" : source === "react-router" ? "router" : source.endsWith("/auth") ? "auth" : "api",
            namespace: "ui-mock",
          }));
          builder.onLoad({ filter: /.*/, namespace: "ui-mock" }, ({ path: source }) => ({ contents: mocks[source], loader: "js" }));
        },
      }],
    });
    compiled.set(file, result.outputFiles[0].text);
  }
  const same = (a, b) => a && b && a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
  const slots = [];
  let cursor = 0;
  let effects = [];
  let component;
  const storage = options.storage ?? memoryStorage();
  const h = {
    auth: { token: "token-a", login: "alice", scopes: ["repo"], loading: false, error: null, retryable: false },
    session: "session-a", query: new URLSearchParams(), params: {}, location: { pathname: "/compare" },
    api: {}, dirty: false, tree: null, writesAfterUnmount: 0, mounted: true,
    navigate: (target) => { h.destination = target; }, beginLogin: (value) => { h.loginOptions = value; },
    retryAuth: () => { h.retries = (h.retries ?? 0) + 1; },
    useState(initial) {
      const index = cursor++;
      slots[index] ??= { value: typeof initial === "function" ? initial() : initial };
      return [slots[index].value, (next) => {
        if (!h.mounted) h.writesAfterUnmount++;
        const value = typeof next === "function" ? next(slots[index].value) : next;
        if (!Object.is(value, slots[index].value)) { slots[index].value = value; h.dirty = true; }
      }];
    },
    useRef(value) { const index = cursor++; return (slots[index] ??= { current: value }); },
    useCallback(callback, deps) {
      const index = cursor++;
      if (!same(slots[index]?.deps, deps)) slots[index] = { deps, callback };
      return slots[index].callback;
    },
    useEffect(callback, deps) {
      const index = cursor++;
      if (!same(slots[index]?.deps, deps)) effects.push(() => {
        slots[index]?.cleanup?.();
        slots[index] = { deps, effect: callback, cleanup: callback() };
      });
    },
    render(nextComponent = component) {
      component = nextComponent;
      for (let count = 0; count < 20; count++) {
        cursor = 0; effects = []; h.dirty = false;
        h.tree = component();
        for (const effect of effects) effect();
        if (!h.dirty) return h.tree;
      }
      throw new Error("Effect render loop");
    },
    async settle() {
      for (let i = 0; i < 8; i++) {
        await new Promise((resolve) => setImmediate(resolve));
        if (h.dirty) h.render();
      }
    },
    replayEffects() {
      for (const slot of slots) slot?.cleanup?.();
      for (const slot of slots) if (slot?.effect) slot.cleanup = slot.effect();
      if (h.dirty) h.render();
    },
    unmount() { for (const slot of slots) slot?.cleanup?.(); h.mounted = false; },
  };
  h.auth.signOut = () => {
    h.auth = { ...h.auth, token: null, login: null, scopes: [] };
    h.session = "signed-out";
    storage.clear();
    h.dirty = true;
  };
  Object.assign(h, options);
  const module = { exports: {} };
  vm.runInNewContext(compiled.get(file), {
    __h: h, module, exports: module.exports, require: createRequire(filename),
    console, Error, TypeError, URL, URLSearchParams, AbortController, AbortSignal, setTimeout, clearTimeout,
    localStorage: storage, sessionStorage: options.sessionStorage ?? memoryStorage(),
    window: { location: { origin: "https://example.test", pathname: "/GitScope/compare" } },
  }, { filename });
  return { h, exports: module.exports, storage };
}

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function nodes(tree) {
  if (tree == null || typeof tree === "boolean") return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return [tree, ...(typeof tree === "object" ? nodes(tree.props?.children) : [])];
}
function text(tree) { return nodes(tree).filter((node) => typeof node === "string" || typeof node === "number").join(" "); }
function dashboard(login) {
  return { user: { login, created_at: "2020-01-01", public_repos: 0 }, repos: [], profile: null,
    warnings: [], trafficCoverage: { views: 0, clones: 0, total: 0 }, viewsTimeline: [], clonesTimeline: [],
    referrers: [], lastSynced: "2026-09-19", totalStars: 0, totalForks: 0 };
}

test("dashboard aborts on sign-out; a late response cannot render or restore its cache", async () => {
  const pending = deferred();
  let signal;
  const { h, exports: page, storage } = await pageHarness("pages/Dashboard.tsx", {
    api: { fetchDashboardData: (_token, _progress, requestSignal) => { signal = requestSignal; return pending.promise; } },
  });
  h.render(page.Dashboard);
  nodes(h.tree).find((node) => node?.type === "button" && text(node) === "Sign out").props.onClick();
  assert.equal(signal.aborted, true);
  h.render();
  pending.resolve(dashboard("alice"));
  await h.settle();
  assert.equal(storage.length, 0);
  assert.match(text(h.tree), /Sign in with GitHub/);
  assert.doesNotMatch(text(h.tree), /alice/);
});

test("dashboard isolates account/session caches and rejects an older account response", async () => {
  const requests = [];
  const { h, exports: page, storage } = await pageHarness("pages/Dashboard.tsx", {
    api: { fetchDashboardData: (_token, _progress, signal) => {
      const request = { ...deferred(), signal }; requests.push(request); return request.promise;
    } },
  });
  h.render(page.Dashboard);
  h.auth = { ...h.auth, token: "token-b", login: "bob" }; h.session = "session-b"; h.render();
  assert.equal(requests[0].signal.aborted, true);
  requests[1].resolve(dashboard("bob")); await h.settle();
  requests[0].resolve(dashboard("alice")); await h.settle();
  assert.equal(storage.length, 1);
  assert.equal(storage.key(0), "gitscope_dashboard:bob:session-b");
  assert.match(text(h.tree), /bob/);
  assert.doesNotMatch(text(h.tree), /alice/);
});

test("StrictMode effect replay starts a replacement request and ignores the discarded result", async () => {
  const requests = [];
  const { h, exports: page, storage } = await pageHarness("pages/Dashboard.tsx", {
    api: { fetchDashboardData: (_token, _progress, signal) => {
      const request = { ...deferred(), signal }; requests.push(request); return request.promise;
    } },
  });
  h.render(page.Dashboard);
  h.replayEffects();
  assert.equal(requests.length, 2);
  assert.equal(requests[0].signal.aborted, true);
  requests[1].resolve(dashboard("alice")); await h.settle();
  h.unmount();
  requests[0].resolve(dashboard("alice")); await h.settle();
  assert.equal(h.writesAfterUnmount, 0);
  assert.equal(storage.length, 1);
});

test("a fresh Compare URL auto-loads, aborts on query changes, and keeps the newest profiles", async () => {
  const requests = [];
  const { h, exports: page } = await pageHarness("pages/Compare.tsx", {
    query: new URLSearchParams("user1=first&user2=second"),
    api: { fetchFullProfile: (username, _token, signal) => {
      const request = { ...deferred(), username, signal }; requests.push(request); return request.promise;
    } },
  });
  h.render(page.Compare);
  assert.deepEqual(requests.map((request) => request.username), ["first", "second"]);
  h.query = new URLSearchParams("user1=third&user2=fourth"); h.render();
  assert.equal(requests[0].signal.aborted, true);
  requests[2].resolve({ user: { login: "third" }, totalContributions: 1 });
  requests[3].resolve({ user: { login: "fourth" }, totalContributions: 2 });
  await h.settle();
  requests[0].resolve({ user: { login: "first" }, totalContributions: 1 });
  requests[1].resolve({ user: { login: "second" }, totalContributions: 2 });
  await h.settle();
  const profiles = nodes(h.tree).filter((node) => node?.props?.stats).map((node) => node.props.stats.user.login);
  assert.deepEqual(profiles, ["third", "fourth"]);
});

test("Compare reports a public fallback instead of claiming full contribution data", async () => {
  const { h, exports: page } = await pageHarness("pages/Compare.tsx", {
    query: new URLSearchParams("user1=first&user2=second"),
    api: {
      fetchFullProfile: async () => { throw new Error("GraphQL unavailable"); },
      fetchPublicProfile: async (login) => ({ user: { login } }),
    },
  });
  h.render(page.Compare); await h.settle();
  assert.match(text(h.tree), /contribution statistics are unavailable/);
  assert.doesNotMatch(text(h.tree), /contribution statistics loaded for both profiles/);
});

test("RepoDetail aborts the previous repository and does not report its failure on the next route", async () => {
  const requests = [];
  const { h, exports: page } = await pageHarness("pages/RepoDetail.tsx", {
    params: { name: "first" },
    api: { fetchRepoDetail: (_login, name, _token, signal) => {
      const request = { ...deferred(), name, signal }; requests.push(request); return request.promise;
    } },
  });
  h.render(page.RepoDetail);
  h.params = { name: "second" }; h.render();
  requests[0].reject(new Error("first repository failed")); await h.settle();
  assert.equal(requests[0].signal.aborted, true);
  assert.match(text(h.tree), /Loading\s+second/);
  assert.doesNotMatch(text(h.tree), /first repository failed/);
  h.unmount();
  requests[1].reject(new Error("late error")); await h.settle();
  assert.equal(h.writesAfterUnmount, 0);
});

test("cache failures are optional; cache identity and expiry must match", async () => {
  const { exports: cache, h, storage } = await pageHarness("components/uiLifecycle.ts");
  const key = cache.accountCacheKey("dashboard", "Alice", h.session);
  cache.writeAccountCache(key, "Alice", h.session, { private: "alice-data" });
  assert.equal(cache.readAccountCache(key, "alice", h.session, 300000).private, "alice-data");
  assert.equal(cache.readAccountCache(key, "bob", h.session, 300000), null);
  h.session = "new-session";
  assert.equal(cache.readAccountCache(key, "alice", "session-a", 300000), null);
  cache.writeAccountCache("stale", "alice", "session-a", { private: "late" });
  assert.equal(storage.getItem("stale"), null);
  const stale = JSON.parse(storage.getItem(key)); stale.timestamp = Date.now() - 400000;
  storage.setItem(key, JSON.stringify(stale)); h.session = "session-a";
  assert.equal(cache.readAccountCache(key, "alice", h.session, 300000), null);
  storage.setItem = () => { throw new Error("Storage disabled"); };
  assert.doesNotThrow(() => cache.writeAccountCache(key, "alice", h.session, {}));
});

test("leaderboard failure is visible and never caches or ranks an incomplete result", async () => {
  const { h, exports: page, storage } = await pageHarness("pages/Leaderboard.tsx", {
    api: {
      fetchFollowing: async () => ["bob"],
      fetchAllUsers: async () => { throw new Error("GitHub rate limit exceeded"); },
    },
  });
  h.render(page.Leaderboard); await h.settle();
  assert.match(text(h.tree), /GitHub rate limit exceeded/);
  assert.match(text(h.tree), /Try again/);
  assert.doesNotMatch(text(h.tree), /Your rank/);
  assert.equal(storage.length, 0);
});

test("traffic permission is requested only as an explicit upgrade", async () => {
  const { h, exports: page } = await pageHarness("pages/Dashboard.tsx");
  h.auth = { ...h.auth, token: null, login: null, scopes: [] }; h.render(page.Dashboard);
  assert.equal(nodes(h.tree).find((node) => node?.type?.name === "LoginLink").props.traffic, false);
  h.auth = { ...h.auth, token: "basic", login: "alice", scopes: ["read:user"] }; h.render();
  assert.equal(nodes(h.tree).find((node) => node?.type?.name === "LoginLink").props.traffic, true);
  assert.match(text(h.tree), /Enable traffic analytics/);
});

test("signed-out auth errors offer both verification retry and sign-in on every account page", async () => {
  for (const name of ["Dashboard", "Compare", "Leaderboard"]) {
    const { h, exports: page } = await pageHarness(`pages/${name}.tsx`);
    h.auth = { ...h.auth, token: null, login: null, scopes: [], error: "Could not verify your GitHub sign-in." };
    h.render(page[name]);
    const retry = nodes(h.tree).find((node) => node?.type === "button" && text(node) === "Retry verification");
    assert.ok(retry, `${name} exposes verification retry`);
    assert.match(text(h.tree), /Could not verify your GitHub sign-in/);
    assert.ok(nodes(h.tree).find((node) => node?.type?.name === "LoginLink"), `${name} retains sign-in`);
    retry.props.onClick();
    assert.equal(h.retries, 1);
  }
});

test("Dashboard keeps auth recovery visible alongside loading, loaded data, and data errors", async () => {
  for (const fails of [false, true]) {
    const pending = deferred();
    const { h, exports: page } = await pageHarness("pages/Dashboard.tsx", {
      api: { fetchDashboardData: () => pending.promise },
    });
    h.auth.error = "Verification is temporarily unavailable.";
    const assertRecovery = () => {
      assert.match(text(h.tree), /Verification is temporarily unavailable/);
      const retry = nodes(h.tree).find((node) => node?.type === "button" && text(node) === "Retry verification");
      assert.ok(retry);
      retry.props.onClick();
    };
    h.render(page.Dashboard);
    assertRecovery();
    if (fails) pending.reject(new Error("Dashboard request failed"));
    else pending.resolve(dashboard("alice"));
    await h.settle();
    assertRecovery();
    assert.equal(h.auth.token, "token-a");
    assert.equal(h.retries, 2);
    if (!fails) assert.match(text(h.tree), /alice/);
  }
});

test("login preserves a Compare query across auth cache cleanup and uses the basic auth contract", async () => {
  const sessionStorage = memoryStorage();
  const { h, exports: login } = await pageHarness("components/LoginLink.tsx", { sessionStorage });
  h.render(() => login.LoginLink({ returnTo: "/compare?user1=alice&user2=bob", children: "Sign in" }));
  h.tree.props.onClick();
  assert.equal(h.loginOptions.traffic, false);
  assert.equal(h.loginOptions.returnTo, "compare");
  const callback = await pageHarness("components/LoginLink.tsx", { sessionStorage });
  sessionStorage.clear(); // accepting a new auth session clears gitscope_ keys
  callback.h.session = "new-login-session";
  callback.h.render(callback.exports.LoginReturn);
  assert.equal(callback.h.destination, "/compare?user1=alice&user2=bob");
});

test("retryable verification preserves Compare and repository destinations until retry succeeds", async () => {
  for (const returnTo of ["/compare?user1=alice&user2=bob", "/dashboard/repo/example"]) {
    for (const token of [null, "existing-session-token"]) {
      const sessionStorage = memoryStorage();
      sessionStorage.setItem("gitscope_ui_return", JSON.stringify({
        path: returnTo, timestamp: Date.now(), session: "before-login",
      }));
      const { h, exports: login } = await pageHarness("components/LoginLink.tsx", { sessionStorage });
      h.auth = { ...h.auth, token, error: "Temporary verification failure.", retryable: true };
      h.render(login.LoginReturn);
      assert.equal(h.destination, undefined);
      assert.equal(JSON.parse(sessionStorage.getItem("gitscope_ui_return")).path, returnTo);

      h.retryAuth = () => {
        h.auth = { ...h.auth, loading: true, error: null };
      };
      h.retryAuth();
      h.render();
      assert.equal(h.destination, undefined);
      assert.ok(sessionStorage.getItem("gitscope_ui_return"));

      sessionStorage.clear(); // successful storeAuth clears the old session's caches
      h.auth = { ...h.auth, token: "verified-token", loading: false, error: null, retryable: false };
      h.session = "verified-session";
      h.render();
      assert.equal(h.destination, returnTo);
      assert.equal(sessionStorage.getItem("gitscope_ui_return"), null);
      h.destination = undefined;
      h.session = "another-session";
      h.render();
      assert.equal(h.destination, undefined, "a destination is consumed only once");
    }
  }
});

test("terminal cancellation clears the persisted and captured destination", async () => {
  const sessionStorage = memoryStorage();
  sessionStorage.setItem("gitscope_ui_return", JSON.stringify({
    path: "/compare?user1=alice&user2=bob", timestamp: Date.now(), session: "before-login",
  }));
  const { h, exports: login } = await pageHarness("components/LoginLink.tsx", { sessionStorage });
  h.auth = { ...h.auth, error: "GitHub sign-in was cancelled.", retryable: false };
  h.render(login.LoginReturn);
  assert.equal(h.destination, undefined);
  assert.equal(sessionStorage.getItem("gitscope_ui_return"), null);
  h.auth = { ...h.auth, error: null };
  h.session = "later-login";
  h.render();
  assert.equal(h.destination, undefined, "later authentication must not reuse a cancelled destination");
});

test("retryable errors cannot retain invalid or expired destinations", async () => {
  for (const pending of [
    { path: "https://other.example/compare", timestamp: Date.now() },
    { path: "/dashboard/repo/example", timestamp: Date.now() - 600001 },
  ]) {
    const sessionStorage = memoryStorage();
    sessionStorage.setItem("gitscope_ui_return", JSON.stringify({ ...pending, session: "before-login" }));
    const { h, exports: login } = await pageHarness("components/LoginLink.tsx", { sessionStorage });
    h.auth = { ...h.auth, error: "Temporary verification failure.", retryable: true };
    h.render(login.LoginReturn);
    assert.equal(h.destination, undefined);
    assert.equal(sessionStorage.getItem("gitscope_ui_return"), null);
    h.auth = { ...h.auth, error: null, retryable: false };
    h.session = "verified-session";
    h.render();
    assert.equal(h.destination, undefined);
  }
});

test("auth controls expose no worker href and initialize same-tab login only on button activation", async () => {
  for (const [returnTo, traffic, page] of [
    ["/compare?user1=alice&user2=bob", false, "compare"],
    ["/leaderboard", false, "leaderboard"],
    ["/dashboard", false, "dashboard"],
    ["/dashboard/repo/example", true, "dashboard"],
  ]) {
    const sessionStorage = memoryStorage();
    const { h, exports: login } = await pageHarness("components/LoginLink.tsx", { sessionStorage });
    const calls = [];
    h.beginLogin = (options) => {
      assert.equal(JSON.parse(sessionStorage.getItem("gitscope_ui_return")).path, returnTo);
      calls.push(options);
    };
    h.render(() => login.LoginLink({ returnTo, traffic, className: "existing-login-style", children: "Sign in" }));
    assert.equal(h.tree.type, "button");
    assert.equal(h.tree.props.type, "button");
    assert.equal(h.tree.props.className, "existing-login-style");
    assert.equal(nodes(h.tree).some((node) => node?.props?.href !== undefined), false);
    assert.equal(h.tree.props.target, undefined);
    assert.equal(calls.length, 0);
    h.tree.props.onClick();
    assert.equal(calls.length, 1);
    assert.equal(calls[0].returnTo, page);
    assert.equal(calls[0].traffic, traffic);
  }
});

test("mobile navigation exposes current route and can be closed with Escape", async () => {
  const { h, exports: page } = await pageHarness("components/Header.tsx", { location: { pathname: "/dashboard/repo/example" } });
  h.render(page.Header);
  const toggle = () => nodes(h.tree).find((node) => node?.props?.["aria-controls"] === "primary-navigation");
  assert.equal(toggle().props["aria-expanded"], false);
  toggle().props.onClick(); h.render();
  assert.equal(toggle().props["aria-expanded"], true);
  assert.equal(nodes(h.tree).find((node) => node?.props?.to === "/dashboard").props["aria-current"], "page");
  nodes(h.tree).find((node) => node?.type === "nav").props.onKeyDown({ key: "Escape" });
  h.render();
  assert.equal(toggle().props["aria-expanded"], false);
});

test("charts expose data tables and distinguish unavailable traffic from a measured zero", () => {
  const requireWebsite = createRequire(path.resolve(__dirname, "../website/src/App.tsx"));
  const React = requireWebsite("react");
  const { renderToStaticMarkup } = requireWebsite("react-dom/server");
  const { TrafficAreaChart } = loadModule("website/src/components/charts/TrafficAreaChart.tsx");
  const unavailable = renderToStaticMarkup(React.createElement(TrafficAreaChart, { title: "Views", unavailable: true, data: [] }));
  assert.match(unavailable, /Traffic unavailable/);
  const measured = renderToStaticMarkup(React.createElement(TrafficAreaChart, {
    title: "Views", data: [{ date: "2026-09-19", count: 0, uniques: 0 }], uniqueLabel: "Sum of repository uniques",
  }));
  assert.match(measured, /<summary>View chart data<\/summary>/);
  assert.match(measured, /scope="col">Sum of repository uniques/);
  assert.match(measured, /scope="row">2026-09-19/);
  assert.doesNotMatch(measured, /Traffic unavailable/);
});
