// Reports, and optionally asserts, the version the Chrome Web Store has published.
//
// The upload action's publish call has returned HTTP 400 on releases that did in
// fact publish (1.2.1 and 1.2.2 both went public while the job reported failure),
// so a release must not decide success from that exit code alone. Ask the store.
//
// Runs only in trusted GitHub Actions jobs. Never log credentials or token bodies.
const names = ["CHROME_CLIENT_ID", "CHROME_CLIENT_SECRET", "CHROME_REFRESH_TOKEN", "CHROME_EXTENSION_ID"];
for (const name of names) {
  if (!process.env[name]) throw new Error(`Missing ${name}. Configure the repository release secret.`);
}

const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    client_id: process.env.CHROME_CLIENT_ID,
    client_secret: process.env.CHROME_CLIENT_SECRET,
    refresh_token: process.env.CHROME_REFRESH_TOKEN,
    grant_type: "refresh_token",
  }),
  signal: AbortSignal.timeout(20_000),
});
if (!tokenResponse.ok) {
  throw new Error(`Chrome Web Store authorization failed (HTTP ${tokenResponse.status}). Renew the release credentials before publishing.`);
}
const { access_token: accessToken } = await tokenResponse.json();
if (!accessToken) throw new Error("Chrome Web Store did not return an access token.");

const item = process.env.CHROME_EXTENSION_ID;
async function itemState(projection) {
  const response = await fetch(`https://www.googleapis.com/chromewebstore/v1.1/items/${encodeURIComponent(item)}?projection=${projection}`, {
    headers: { Authorization: `Bearer ${accessToken}`, "x-goog-api-version": "2" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Chrome Web Store ${projection} lookup failed (HTTP ${response.status}).`);
  return response.json();
}

const published = await itemState("PUBLISHED");
const draft = await itemState("DRAFT");
// Only echo values the store itself reported, matched against a version shape.
const version = /^[0-9.]{1,32}$/.exec(String(published.crxVersion ?? ""))?.[0] ?? "unknown";
const draftVersion = /^[0-9.]{1,32}$/.exec(String(draft.crxVersion ?? ""))?.[0] ?? "unknown";
console.log(`Chrome Web Store: published ${version}, draft ${draftVersion}, draft state ${draft.uploadState ?? "unknown"}.`);
if (draft.itemError?.length) {
  console.log(`Store reported item errors: ${draft.itemError.map((error) => error.error_code ?? "unknown").join(", ")}`);
}

const expected = process.argv[2];
if (expected) {
  if (version !== expected) {
    throw new Error(`Chrome Web Store published ${version}, expected ${expected}. The release did not reach the public listing.`);
  }
  console.log(`Verified the public listing serves ${expected}.`);
}
