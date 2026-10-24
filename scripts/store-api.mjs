// Shared Chrome Web Store access for the release checks.
// Runs only in trusted GitHub Actions jobs. Never log credentials or token bodies.

const NAMES = ["CHROME_CLIENT_ID", "CHROME_CLIENT_SECRET", "CHROME_REFRESH_TOKEN", "CHROME_EXTENSION_ID"];

export function requireCredentials() {
  for (const name of NAMES) {
    if (!process.env[name]) throw new Error(`Missing ${name}. Configure the repository release secret.`);
  }
}

export async function accessToken() {
  const response = await fetch("https://oauth2.googleapis.com/token", {
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
  if (!response.ok) {
    throw new Error(`Chrome Web Store authorization failed (HTTP ${response.status}). Renew the release credentials before publishing.`);
  }
  const { access_token: token } = await response.json();
  if (!token) throw new Error("Chrome Web Store did not return an access token.");
  return token;
}

// v1.1 items.get only supports the DRAFT projection; PUBLISHED returns HTTP 400.
// So this confirms what the store holds, not that public rollout has finished.
export async function itemDraft(token) {
  const item = encodeURIComponent(process.env.CHROME_EXTENSION_ID);
  const response = await fetch(`https://www.googleapis.com/chromewebstore/v1.1/items/${item}?projection=DRAFT`, {
    headers: { Authorization: `Bearer ${token}`, "x-goog-api-version": "2" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Chrome Web Store item access failed (HTTP ${response.status}). Check publisher access.`);
  return response.json();
}

// The version Chrome actually hands to users, which is the only proof a release
// shipped. items.get reports the draft, so it stays at the uploaded version even
// when publishing never completed. Public endpoint, no credentials.
export async function servedVersion() {
  const id = process.env.CHROME_EXTENSION_ID;
  const query = encodeURIComponent(`id=${id}&uc`);
  const url = `https://clients2.google.com/service/update2/crx?response=updatecheck&prodversion=130.0&acceptformat=crx3&x=${query}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`Chrome update service failed (HTTP ${response.status}).`);
  // Read the updatecheck element; the document also opens with an XML version.
  const element = /<updatecheck\b[^>]*>/.exec(await response.text())?.[0] ?? "";
  return /\bversion="(\d+(?:\.\d+){0,3})"/.exec(element)?.[1] ?? "unknown";
}
