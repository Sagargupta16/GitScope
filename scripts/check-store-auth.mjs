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
const token = await tokenResponse.json();
if (!token.access_token) throw new Error("Chrome Web Store did not return an access token.");
const item = await fetch(`https://www.googleapis.com/chromewebstore/v1.1/items/${encodeURIComponent(process.env.CHROME_EXTENSION_ID)}?projection=DRAFT`, {
  headers: { Authorization: `Bearer ${token.access_token}`, "x-goog-api-version": "2" },
  signal: AbortSignal.timeout(20_000),
});
if (!item.ok) throw new Error(`Chrome Web Store item access failed (HTTP ${item.status}). Check publisher access.`);
console.log("Chrome Web Store credentials and extension access verified.");
