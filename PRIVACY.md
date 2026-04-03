# Privacy Policy

**GitScope** - Chrome Extension

Last updated: March 28, 2026

## Data Collection

This extension does **not** collect, store, or transmit any personal data to the developer or any third party.

## What Data Is Accessed

The extension and website access the following data from GitHub's API:

- Public profile information (name, username, avatar, follower/following counts)
- Public repository data (names, stars, languages, fork counts)
- Contribution calendar data (contribution counts by date)
- Pull request counts (merged, open, closed)
- Issue counts (open, closed)
- Repositories contributed to (count only)
- Organization membership (count only)

This data is fetched from GitHub's GraphQL API (`api.github.com`) using your authenticated session and is only used to render the insights dashboard on profile pages.

## Authentication

- Authentication is handled via GitHub's standard OAuth 2.0 flow
- The OAuth token exchange is processed by a Cloudflare Worker (`gpi-auth.sg85207.workers.dev`)
- The Cloudflare Worker only exchanges the authorization code for an access token - it does not store, log, or retain any tokens or user data
- Your access token is stored locally in your browser via `chrome.storage.sync`

## Data Storage

- **OAuth token**: Stored in `chrome.storage.sync` (extension) or `localStorage` (website). Local to your browser only.
- **Extension cache**: Profile data is cached in `chrome.storage.local` for 5 minutes to reduce API calls. Cache is automatically cleared after expiry.
- **Website cache**: Leaderboard data is cached in `localStorage` for 10 minutes. Cleared on sign-out or manual refresh.
- No data is stored on any external server

## Network Requests

The extension only communicates with:

1. `api.github.com` - To fetch profile data via GitHub's GraphQL API
2. `gpi-auth.sg85207.workers.dev` - OAuth token exchange only (during sign-in)

No other network requests are made. No analytics, telemetry, or tracking services are used.

## Permissions

| Permission | Purpose |
|---|---|
| `storage` | Store OAuth token and cache API responses locally |
| `api.github.com` (host permission) | Fetch profile data from GitHub's API |

## Third-Party Services

- **GitHub API** (api.github.com) - Used to fetch public profile and contribution data. Subject to [GitHub's Privacy Statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement).
- **Cloudflare Workers** (gpi-auth.sg85207.workers.dev) - Used solely for OAuth token exchange during sign-in. No data is logged or retained.

## Data Deletion

To remove all data stored by this extension:

1. Click the extension icon and click **Sign Out** (clears the OAuth token)
2. Uninstall the extension from `chrome://extensions` (clears all stored data including cache)

## Open Source

This extension is fully open source. You can audit the complete source code at:
https://github.com/Sagargupta16/GitScope

## Contact

For privacy questions or concerns, open an issue at:
https://github.com/Sagargupta16/GitScope/issues
