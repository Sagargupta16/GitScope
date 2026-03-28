# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-03-28

### Added

- Initial release
- Stats grid: total stars, yearly contributions, current/longest streak, merged PRs, repos
- Language breakdown with color-coded bar chart and legend
- Top 5 repositories section by star count
- 20-week activity heatmap
- Contribution breakdown donut chart (commits, PRs, reviews, issues)
- Activity by day of week bar chart with most active day highlight
- Footer stats: busiest day, starred repos count
- GitHub OAuth authentication via Cloudflare Worker (one-click sign in)
- Background service worker for API calls (CORS-safe)
- Parameterized GraphQL queries (no injection risk)
- API response caching (5-minute TTL via chrome.storage.local)
- Loading skeleton with shimmer animation
- GitHub SPA navigation support (turbo:load + popstate)
- Automatic dark/light theme via GitHub CSS custom properties
- Fade-in animation on panel injection
- esbuild bundler (src/ -> dist/)
- ES modules with modern JavaScript (const/let, arrow functions, template literals)
- Privacy policy (PRIVACY.md)
- Manifest V3

[1.0.0]: https://github.com/Sagargupta16/gitscope/releases/tag/v1.0.0
