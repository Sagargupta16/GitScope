# GitScope

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?logo=googlechrome&logoColor=white)](https://github.com/Sagargupta16/gitscope)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-green)](src/manifest.json)

> Browser extension that adds contribution insights to any GitHub profile - streaks, language breakdown, PR stats, activity heatmap, and more.

## Features

- **Stats Grid** - Total stars, yearly contributions, current/longest streak, merged PRs, repository count
- **Language Breakdown** - Color-coded bar chart and legend showing language distribution
- **Top Repositories** - Top 5 repos by stars with language and star count
- **Activity Heatmap** - Compact 20-week contribution heatmap
- **Contribution Donut** - Commits, PRs, reviews, and issues breakdown chart
- **Activity by Day** - Bar chart showing which day of the week you're most active
- **Footer Stats** - Busiest day of the year, starred repos count
- **Loading Skeleton** - Shimmer animation while data loads
- **Dark Theme** - Automatically adapts to GitHub's light/dark theme
- **SPA Navigation** - Works across GitHub page transitions (turbo:load)
- **Caching** - 5-minute TTL to avoid redundant API calls
- **Privacy First** - OAuth token stored locally, secrets server-side

## Installation

### Chrome (Developer Mode)

1. Clone and build:
   ```bash
   git clone https://github.com/Sagargupta16/gitscope.git
   cd gitscope
   npm install
   npm run build
   ```
2. Open `chrome://extensions` in Chrome
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** and select the `dist/` folder
5. Click the extension icon and click **"Sign in with GitHub"**
6. Authorize the app on GitHub - done!

## How It Works

```
User visits github.com/<username>
    |
    v
Content Script (content.js)
    | detects profile page
    v
Background Worker (background.js)
    | sends GraphQL query to api.github.com
    | (parameterized variables - no injection)
    v
Dashboard (dashboard.js + charts.js)
    | builds panel with stats, charts, heatmap
    v
Injected into GitHub sidebar
    | cached for 5 minutes per profile
```

**Authentication** uses GitHub OAuth via a Cloudflare Worker (`worker/`). The worker holds the client secret server-side and exchanges the auth code for a token. No secrets in the extension code.

## Project Structure

```
gitscope/
  src/                       # Source code
    manifest.json            # Extension manifest (Manifest V3)
    css/insights.css         # Dashboard styles (GitHub theme-aware)
    html/popup.html          # Extension popup (OAuth sign in/out)
    icons/                   # Extension icons (16/32/48/128px + SVG)
    js/
      content.js             # Entry point (profile detection, SPA nav)
      background.js          # Service worker (API calls, avoids CORS)
      api.js                 # GitHub GraphQL queries (parameterized)
      charts.js              # Pure CSS/SVG chart rendering
      dashboard.js           # Panel construction and injection
      storage.js             # Chrome storage + caching helpers
      utils.js               # Utility functions
      popup.js               # Popup OAuth management
      auth-callback.js       # OAuth callback token capture
  worker/                    # Cloudflare Worker (OAuth token exchange)
    index.js                 # Worker code
    wrangler.toml            # Wrangler config
  build.js                   # esbuild bundler script
  dist/                      # Built extension (load this in Chrome)
  package.json
```

## Tech Stack

- **Manifest V3** - Latest Chrome extension API
- **ES Modules** - Modern `import`/`export`, `const`/`let`, arrow functions
- **esbuild** - Fast bundler (src/ -> dist/ in <1s)
- **GitHub GraphQL API** - Single query fetches all profile data
- **Cloudflare Workers** - Serverless OAuth token exchange
- **Zero runtime dependencies** - Pure vanilla JS, no frameworks
- **CSS Custom Properties** - GitHub's theme variables for automatic light/dark

## Privacy

- Authentication via GitHub OAuth (standard OAuth 2.0 flow)
- Token stored in `chrome.storage.sync` (local to your browser, syncs across Chrome instances)
- Client secret stored server-side on Cloudflare Worker (not in extension code)
- API responses cached locally for 5 minutes
- No analytics, no tracking, no telemetry
- Only communicates with `api.github.com` and `gpi-auth.sg85207.workers.dev` (OAuth only)
- Source code is fully open and auditable

See [PRIVACY.md](PRIVACY.md) for the full privacy policy.

## Development

```bash
npm install          # Install esbuild
npm run build        # Build to dist/
npm run watch        # Watch mode (rebuild on changes)
```

Load `dist/` as an unpacked extension in Chrome for testing.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

[MIT](LICENSE)
