// Reports, and optionally asserts, the version the Chrome Web Store holds.
//
// The upload action's publish call has returned HTTP 400 on releases that did in
// fact reach the store (1.2.1 and 1.2.2 both did while the job reported failure),
// so a release must not decide success from that exit code alone. Ask the store.
//
// Runs only in trusted GitHub Actions jobs. Never log credentials or token bodies.
import { requireCredentials, accessToken, itemDraft } from "./store-api.mjs";

requireCredentials();
const draft = await itemDraft(await accessToken());

// The store's response is remote input. Match each field against its expected
// shape here at the log site, so only the matched text is ever printed.
const version = /^[0-9.]{1,32}$/.exec(String(draft.crxVersion ?? ""))?.[0] ?? "unknown";
const state = /^[A-Z_]{1,32}$/.exec(String(draft.uploadState ?? ""))?.[0] ?? "unknown";
console.log(`Chrome Web Store: item version ${version}, upload state ${state}.`);
if (draft.itemError?.length) {
  const codes = draft.itemError
    .map((error) => /^[\w.-]{1,64}$/.exec(String(error.error_code ?? ""))?.[0] ?? "unknown")
    .join(", ");
  console.log(`Store reported item errors: ${codes}`);
}

const expected = process.argv[2];
if (expected) {
  if (version !== expected) {
    throw new Error(`Chrome Web Store holds ${version}, expected ${expected}. The upload did not reach the store.`);
  }
  console.log(`Verified the store holds ${expected}. Public rollout follows store review.`);
}
