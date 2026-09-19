// Confirms the release credentials still work, without uploading or publishing.
// Runs only in trusted GitHub Actions jobs. Never log credentials or token bodies.
import { requireCredentials, accessToken, itemDraft } from "./store-api.mjs";

requireCredentials();
await itemDraft(await accessToken());
console.log("Chrome Web Store credentials and extension access verified.");
