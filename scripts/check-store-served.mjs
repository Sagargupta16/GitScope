// Reports, and optionally asserts, the version Chrome actually serves users.
//
// Deliberately needs no credentials. The release token has expired repeatedly
// (Sep 19 to Sep 27 was 8 days, the 7-day expiry of an OAuth client left in
// Testing), and when that happens every authenticated check goes dark. Whether a
// release reached users is the one thing that must stay observable regardless.
import { servedVersion } from "./store-api.mjs";

if (!process.env.CHROME_EXTENSION_ID) {
  throw new Error("Missing CHROME_EXTENSION_ID. Configure the repository release secret.");
}

const served = await servedVersion();
console.log(`Chrome serves users: ${served}.`);

const expected = process.argv[2];
if (expected && served !== expected) {
  throw new Error(`Chrome serves ${served}, expected ${expected}. The release has not reached users.`);
}
if (expected) console.log(`Verified users are served ${expected}.`);
