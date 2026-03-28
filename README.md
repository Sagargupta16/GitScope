# GitHub Profile Insights

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?logo=googlechrome&logoColor=white)](https://github.com/Sagargupta16/github-profile-insights)

> A browser extension that adds contribution insights to any GitHub profile - streaks, language breakdown, PR stats, and activity heatmap.

## Features

- **Stats Grid** - Total stars, contributions this year, current/longest streak, merged PRs, repository count
- **Language Breakdown** - Visual bar chart and legend showing language distribution across repos
- **Activity Heatmap** - Compact 16-week contribution heatmap in the sidebar
- **PR Breakdown** - Donut chart showing merged/open/closed pull request ratio
- **Busiest Day** - Highlights your most productive day this year
- **Dark Theme** - Automatically adapts to GitHub's light/dark theme
- **Privacy First** - Token stored locally, never sent anywhere except GitHub's API

## Installation

### Chrome (Developer Mode)

1. Clone this repository:
   ```bash
   git clone https://github.com/Sagargupta16/github-profile-insights.git
   ```
2. Open `chrome://extensions` in Chrome
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** and select the cloned folder
5. Click the extension icon and add your GitHub token

### Creating a Token

1. Go to [GitHub Settings > Tokens](https://github.com/settings/tokens/new)
2. Select **Fine-grained token**
3. Grant **read:user** permission (read-only)
4. Copy the token and paste it in the extension popup

> Your token is stored locally via `chrome.storage.sync` and only used for GitHub API requests. It is never sent to any third-party server.

## How It Works

The extension detects GitHub profile pages (`github.com/<username>`) and injects a dashboard panel in the sidebar using GitHub's GraphQL API. It fetches:

- Repository data (languages, stars, fork counts)
- Contribution calendar (streaks, heatmap)
- Pull request statistics (merged, open, closed)

All rendering is done with vanilla JavaScript and CSS - no external libraries, no build step.

## Project Structure

```
github-profile-insights/
  manifest.json          # Extension manifest (Manifest V3)
  css/
    insights.css         # Dashboard styles (GitHub theme-aware)
  html/
    popup.html           # Extension popup (token settings)
  js/
    api.js               # GitHub GraphQL API layer
    charts.js            # Pure CSS/SVG chart rendering
    dashboard.js         # Dashboard panel construction
    main.js              # Entry point (profile page detection)
    popup-script.js      # Popup token management
    utils.js             # Helper functions
  icons/                 # Extension icons (16/32/48/128px)
```

## Tech Stack

- **Manifest V3** - Modern Chrome extension API
- **GitHub GraphQL API** - Efficient data fetching in a single request
- **Vanilla JS** - No frameworks, no build step, no dependencies
- **CSS Custom Properties** - Uses GitHub's theme variables for light/dark support

## Privacy

- Token is stored in `chrome.storage.sync` (local to your browser)
- No analytics, no tracking, no third-party requests
- Only communicates with `api.github.com`
- Source code is fully auditable

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

[MIT](LICENSE)
