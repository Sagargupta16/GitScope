const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadModule } = require("./helpers.cjs");

const env = {
  CLIENT_ID: "test-client",
  CLIENT_SECRET: "test-secret",
  REDIRECT_URI: "https://auth.example/callback",
  SITE_URL: "https://sagargupta16.github.io/GitScope",
};
function setup(overrides = {}) {
  let exchanges = 0;
  const { default: worker } = loadModule("worker/index.js", {
    fetch: async () => {
      exchanges++;
      return Response.json({ access_token: "fixture-token", scope: "read:user,read:org" });
    },
    ...overrides,
  });
  return { worker, exchanges: () => exchanges };
}
test("OAuth login creates unpredictable state and a secure browser-bound cookie", async () => {
  const { worker } = setup();
  const first = await worker.fetch(new Request("https://auth.example/login"), env);
  const second = await worker.fetch(new Request("https://auth.example/login"), env);
  const state = new URL(first.headers.get("location")).searchParams.get("state");
  assert.ok(state && state.length >= 32);
  assert.notEqual(state, new URL(second.headers.get("location")).searchParams.get("state"));
  assert.match(first.headers.get("set-cookie"), /HttpOnly/);
  assert.match(first.headers.get("set-cookie"), /Secure/);
  assert.match(first.headers.get("set-cookie"), /SameSite=Lax/);
});
test("callback rejects missing or mismatched state before exchanging any code", async () => {
  const { worker, exchanges } = setup();
  const response = await worker.fetch(new Request("https://auth.example/callback?code=fake&state=web"), env);
  assert.equal(response.status, 400);
  assert.equal(exchanges(), 0);
});
test("basic website login does not request repo scope", async () => {
  const { worker } = setup();
  const response = await worker.fetch(new Request("https://auth.example/web/login?client_state=" + "a".repeat(64)), env);
  const scope = new URL(response.headers.get("location")).searchParams.get("scope").split(" ");
  assert.ok(!scope.includes("repo"));
});
test("matching callback returns to the requested tool and clears its cookie", async () => {
  const { worker } = setup();
  const login = await worker.fetch(new Request("https://auth.example/web/login?client_state=" + "a".repeat(64) + "&return_to=dashboard&traffic=1"), env);
  const state = new URL(login.headers.get("location")).searchParams.get("state");
  const cookie = login.headers.get("set-cookie").split(";")[0];
  const response = await worker.fetch(new Request("https://auth.example/callback?code=fake&state=" + state, { headers: { Cookie: cookie } }), env);
  const target = new URL(response.headers.get("location"));
  assert.equal(target.pathname, "/GitScope/dashboard");
  assert.equal(new URLSearchParams(target.hash.slice(1)).get("state"), "a".repeat(64));
  assert.match(response.headers.get("set-cookie"), /Max-Age=0/);
  assert.match(response.headers.get("cache-control"), /no-store/);
});
test("external return destinations are never accepted", async () => {
  const { worker } = setup();
  const response = await worker.fetch(new Request("https://auth.example/web/login?return_to=https://evil.example"), env);
  assert.equal(response.status, 400);
});

test("tampered or expired cookies are rejected before a token exchange", async () => {
  let now = Date.now();
  class Clock extends Date { static now() { return now; } }
  const { worker, exchanges } = setup({ Date: Clock });
  const login = await worker.fetch(new Request("https://auth.example/login"), env);
  const state = new URL(login.headers.get("location")).searchParams.get("state");
  const cookie = login.headers.get("set-cookie").split(";")[0];
  const callback = "https://auth.example/callback?code=fake&state=" + state;
  const tampered = await worker.fetch(new Request(callback, { headers: { Cookie: cookie + "x" } }), env);
  assert.equal(tampered.status, 400);
  now += 601000;
  const expired = await worker.fetch(new Request(callback, { headers: { Cookie: cookie } }), env);
  assert.equal(expired.status, 400);
  assert.equal(exchanges(), 0);
});

test("legacy website login remains compatible until the new client is deployed", async () => {
  const { worker } = setup();
  const login = await worker.fetch(new Request("https://auth.example/web/login"), env);
  const target = new URL(login.headers.get("location"));
  assert.ok(target.searchParams.get("scope").split(" ").includes("repo"));
  const response = await worker.fetch(new Request("https://auth.example/callback?code=fake&state=" + target.searchParams.get("state"), {
    headers: { Cookie: login.headers.get("set-cookie").split(";")[0] },
  }), env);
  const destination = new URL(response.headers.get("location"));
  assert.equal(destination.pathname, "/GitScope/leaderboard");
  assert.equal(new URLSearchParams(destination.hash.slice(1)).get("token"), "fixture-token");
});

test("cancelled authorization returns the original client nonce without exchanging a token", async () => {
  const { worker, exchanges } = setup();
  const clientState = "b".repeat(64);
  const login = await worker.fetch(new Request("https://auth.example/web/login?client_state=" + clientState + "&return_to=compare"), env);
  const state = new URL(login.headers.get("location")).searchParams.get("state");
  const response = await worker.fetch(new Request("https://auth.example/callback?error=access_denied&state=" + state, {
    headers: { Cookie: login.headers.get("set-cookie").split(";")[0] },
  }), env);
  const target = new URL(response.headers.get("location"));
  const fragment = new URLSearchParams(target.hash.slice(1));
  assert.equal(target.pathname, "/GitScope/compare");
  assert.equal(fragment.get("state"), clientState);
  assert.equal(fragment.get("error"), "auth_failed");
  assert.equal(exchanges(), 0);
});
