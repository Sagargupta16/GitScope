const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadModule, memoryStorage } = require("./helpers.cjs");

function setup(hash = "", overrides = {}) {
  const localStorage = memoryStorage();
  const sessionStorage = memoryStorage();
  const location = { hash, pathname: "/GitScope/dashboard", search: "", assign() {} };
  const history = { replaceState() { location.hash = ""; } };
  const auth = loadModule("website/src/lib/auth.ts", {
    localStorage, sessionStorage, location, history,
    window: { location, history, addEventListener() {}, dispatchEvent() {} },
    require: (name) => name === "react" ? { useSyncExternalStore: (_subscribe, read) => read() } : require(name),
    fetch: async () => Response.json({ login: "alice" }, { headers: { "x-oauth-scopes": "read:user, repo" } }),
    ...overrides,
  });
  return { auth, localStorage, sessionStorage, location };
}

test("tokens are stored in tab session storage, not persistent local storage", () => {
  const { auth, localStorage, sessionStorage } = setup();
  auth.storeAuth("fixture", "alice", ["repo"]);
  assert.equal(auth.getStoredToken(), "fixture");
  assert.equal(localStorage.getItem("gitscope_token"), null);
  assert.ok(sessionStorage.length > 0);
});
test("sign-out clears dashboard, leaderboard and profile caches together", () => {
  const { auth, localStorage, sessionStorage } = setup();
  localStorage.setItem("gitscope_dashboard", "private-a");
  localStorage.setItem("gitscope_leaderboard", "private-a");
  sessionStorage.setItem("gitscope_repo_detail", "private-a");
  localStorage.setItem("unrelated", "keep");
  auth.clearAuth();
  assert.equal(localStorage.getItem("gitscope_dashboard"), null);
  assert.equal(localStorage.getItem("gitscope_leaderboard"), null);
  assert.equal(sessionStorage.getItem("gitscope_repo_detail"), null);
  assert.equal(localStorage.getItem("unrelated"), "keep");
});
test("unsolicited token fragments are rejected and removed from the URL", async () => {
  const { auth, location } = setup("#token=attacker-token&state=" + "a".repeat(64));
  await auth.initializeAuth();
  assert.equal(auth.getStoredToken(), null);
  assert.equal(location.hash, "");
});
test("valid callback matches the pending login, validates identity and consumes state", async () => {
  const { auth, sessionStorage } = setup("#token=fixture&state=" + "a".repeat(64));
  sessionStorage.setItem("gitscope_oauth_pending", JSON.stringify({ state: "a".repeat(64), expires: Date.now() + 10000 }));
  await auth.initializeAuth();
  assert.equal(auth.getStoredLogin(), "alice");
  assert.equal(auth.getStoredToken(), "fixture");
  assert.equal(sessionStorage.getItem("gitscope_oauth_pending"), null);
});

test("temporary identity failures preserve the current session and allow retry", async () => {
  let attempts = 0;
  const { auth, sessionStorage, localStorage } = setup("", {
    fetch: async () => ++attempts === 1 ? new Response("", { status: 503 }) :
      Response.json({ login: "alice" }, { headers: { "x-oauth-scopes": "read:user" } }),
  });
  sessionStorage.setItem("gitscope_auth_v2", JSON.stringify({
    token: "existing", login: "alice", scopes: ["read:user"], sessionId: "existing-session",
  }));
  localStorage.setItem("gitscope_dashboard", "existing-cache");
  await auth.initializeAuth();
  assert.equal(auth.getStoredToken(), "existing");
  assert.equal(auth.getAuthSessionId(), "existing-session");
  assert.equal(auth.useAuth().retryable, true);
  assert.equal(localStorage.getItem("gitscope_dashboard"), "existing-cache");
  await auth.retryAuth();
  assert.equal(attempts, 2);
  assert.equal(auth.getStoredToken(), "existing");
  assert.equal(auth.useAuth().retryable, false);
});

test("a cancelled traffic upgrade preserves the previous basic session", async () => {
  const state = "a".repeat(64);
  const { auth, sessionStorage } = setup("#error=auth_failed&state=" + state);
  sessionStorage.setItem("gitscope_auth_v2", JSON.stringify({
    token: "basic", login: "alice", scopes: ["read:user"], sessionId: "existing-session",
  }));
  sessionStorage.setItem("gitscope_oauth_pending", JSON.stringify({ state, expires: Date.now() + 10000 }));
  await auth.initializeAuth();
  assert.equal(auth.getStoredToken(), "basic");
  assert.equal(auth.getStoredLogin(), "alice");
  assert.equal(auth.useAuth().retryable, false);
  assert.equal(sessionStorage.getItem("gitscope_oauth_pending"), null);
});

test("confirmed invalid stored credentials are removed with their caches", async () => {
  const { auth, sessionStorage, localStorage } = setup("", {
    fetch: async () => new Response("", { status: 401 }),
  });
  sessionStorage.setItem("gitscope_auth_v2", JSON.stringify({
    token: "expired", login: "alice", scopes: [], sessionId: "old",
  }));
  localStorage.setItem("gitscope_dashboard", "private-cache");
  await auth.initializeAuth();
  assert.equal(auth.getStoredToken(), null);
  assert.equal(localStorage.getItem("gitscope_dashboard"), null);
});

test("a slow identity response cannot restore a signed-out account", async () => {
  let finish;
  const { auth, sessionStorage } = setup("", {
    fetch: () => new Promise(resolve => { finish = resolve; }),
  });
  sessionStorage.setItem("gitscope_auth_v2", JSON.stringify({
    token: "old", login: "alice", scopes: [], sessionId: "old",
  }));
  const pending = auth.initializeAuth();
  auth.clearAuth();
  finish(Response.json({ login: "alice" }));
  await pending;
  assert.equal(auth.getStoredToken(), null);
});

test("a validated callback can be retried after a temporary outage without replaying its fragment", async () => {
  let attempts = 0;
  const state = "b".repeat(64);
  const { auth, sessionStorage, location } = setup("#token=upgraded&state=" + state, {
    fetch: async () => ++attempts === 1 ? new Response("", { status: 503 }) :
      Response.json({ login: "alice" }, { headers: { "x-oauth-scopes": "read:user,repo" } }),
  });
  sessionStorage.setItem("gitscope_auth_v2", JSON.stringify({
    token: "basic", login: "alice", scopes: ["read:user"], sessionId: "old",
  }));
  sessionStorage.setItem("gitscope_oauth_pending", JSON.stringify({ state, expires: Date.now() + 10000 }));
  await auth.initializeAuth();
  assert.equal(auth.getStoredToken(), "basic");
  assert.equal(location.hash, "");
  assert.equal(sessionStorage.getItem("gitscope_oauth_pending"), null);
  assert.equal(auth.useAuth().retryable, true);
  await auth.retryAuth();
  assert.equal(auth.getStoredToken(), "upgraded");
  assert.equal(auth.useAuth().retryable, false);
});

test("an invalid callback token cannot discard a different existing session", async () => {
  const state = "c".repeat(64);
  const { auth, sessionStorage } = setup("#token=invalid&state=" + state, {
    fetch: async () => new Response("", { status: 401 }),
  });
  sessionStorage.setItem("gitscope_auth_v2", JSON.stringify({
    token: "basic", login: "alice", scopes: ["read:user"], sessionId: "old",
  }));
  sessionStorage.setItem("gitscope_oauth_pending", JSON.stringify({ state, expires: Date.now() + 10000 }));
  await auth.initializeAuth();
  assert.equal(auth.getStoredToken(), "basic");
});
