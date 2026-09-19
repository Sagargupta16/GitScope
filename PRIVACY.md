# Privacy Policy

GitScope extension and website. Updated September 19, 2026.

## GitHub data

GitScope reads profile information, contribution calendars, repository metadata, pull requests, issues, organizations, and following lists to display analytics. Traffic analytics also reads views, clones, referrers, and repository activity. Repository permissions can include private repository metadata.

GitScope makes read requests to GitHub. It does not create, modify, or delete repositories. The website's optional classic OAuth `repo` scope nevertheless grants broad repository permissions, including write capability. Basic website sign-in does not explicitly request this scope; enabling traffic analytics requests it separately. GitHub may retain permissions you previously granted to the same OAuth app.

## Authentication

A Cloudflare Worker exchanges the GitHub authorization code using a server-side client secret. It validates a signed, short-lived, browser-bound state cookie. The website also validates the pending login in its initiating tab. Token responses are marked non-cacheable.

The Worker has no token database and the application does not intentionally log tokens. GitHub and Cloudflare process requests under their own infrastructure and privacy policies.

## Browser storage

- Extension tokens are stored in `chrome.storage.local`, on the current device. A legacy token in `chrome.storage.sync` is migrated to local storage and removed from sync when used.
- Website tokens are stored in tab `sessionStorage`, not persistent `localStorage`. Existing localStorage sign-ins are validated and migrated. Closing the tab normally ends this session, though browser session restore behavior can vary.
- Extension profile caches expire after five minutes and expired entries are removed when accessed.
- Website dashboard and leaderboard caches use account and sign-in session identifiers, with five-minute and ten-minute freshness periods respectively. They may contain private repository metadata. They are stored in localStorage on this device.
- Sign-out clears GitScope credentials and caches. Website sign-out also notifies other open GitScope tabs on the same origin.
- The GitHub Pages website shares its origin with other sites hosted at `sagargupta16.github.io`; URL paths do not provide a browser security boundary. Do not treat browser storage as a secure vault.

## Network requests

The extension uses `api.github.com` for data, `github.com` for profile pages and authorization, and `gpi-auth.sg85207.workers.dev` for token exchange. Profile images can load from GitHub's avatar service. The website also loads its public screenshot from `raw.githubusercontent.com`.

There is no application analytics, advertising tracker, or telemetry integration. GitScope does not maintain a server-side analytics history or sell data.

## Removing access and data

Sign out to remove GitScope's stored session and caches. Clear site data or uninstall the extension to remove remaining browser storage. To revoke the GitHub token itself, remove GitScope from GitHub Settings > Applications > Authorized OAuth Apps; signing out locally does not revoke GitHub authorization.

## Source and contact

Source: https://github.com/Sagargupta16/GitScope

Questions: https://github.com/Sagargupta16/GitScope/issues
