import assert from "node:assert/strict";

const worker = "https://gpi-auth.sg85207.workers.dev";
const site = "https://sagargupta16.github.io/GitScope/";
async function get(url, options = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(20_000) });
  assert.ok(response.ok || (options.redirect === "manual" && response.status === 302),
    `${new URL(url).pathname}: HTTP ${response.status}`);
  return response;
}
const health = await (await get(`${worker}/health`)).json();
assert.equal(health.protocol, "state-v1", "Deploy the compatible OAuth Worker before releasing the clients.");
const login = await get(`${worker}/web/login?client_state=${"a".repeat(64)}&return_to=compare`, { redirect: "manual" });
const authorize = new URL(login.headers.get("location"));
assert.equal(authorize.origin, "https://github.com");
assert.ok(authorize.searchParams.get("state")?.length >= 32);
assert.ok(!authorize.searchParams.get("scope").split(" ").includes("repo"), "Basic sign-in must not request repository scope.");
assert.match(login.headers.get("set-cookie"), /HttpOnly/);
console.log("OAuth service: healthy; state validation protocol and basic permissions verified.");

if (!process.argv.includes("--auth-only")) {
  const release = await (await get(`${site}release.json?check=${Date.now()}`)).json();
  // release.json is fetched, so treat its contents as untrusted before comparing or logging it.
  assert.match(String(release.sha), /^[0-9a-f]{40}$/, "release.json does not contain a commit SHA.");
  const expected = process.env.EXPECTED_SHA;
  if (expected) assert.equal(release.sha, expected, "The live website is not the expected release.");
  const html = await (await get(`${site}?check=${Date.now()}`)).text();
  const assets = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map((match) => match[1]);
  assert.ok(assets.length >= 2, "Missing website entry assets.");
  for (const asset of assets) {
    const url = new URL(asset, site);
    assert.equal(url.origin, new URL(site).origin);
    await get(url);
  }
  const fallback = await (await get(`${site}404.html`)).text();
  assert.ok(fallback.includes('id="root"'), "Missing SPA fallback.");
  console.log(`Website: release ${release.sha}; entry assets and SPA fallback verified.`);
}
