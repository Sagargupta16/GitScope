# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-04-03

### Added

- Coding personality badge (Builder, Reviewer, Collaborator, Maker, All-Rounder) based on contribution mix
- Quick insights row: average contributions per active day, velocity trend indicator, own/fork ratio
- Contribution velocity tracking (compares last 4 weeks vs previous 4 weeks)
- Repo growth timeline bar chart showing repository creation history by year
- Profile comparison section when viewing someone else's profile (contributions, stars, repos, PRs diff)
- Viewer stats persistence for profile comparison across sessions
- Heatmap legend (Less/More scale)
- Most active weekday highlight in activity chart
- Error state with retry button for failed API calls
- Stat card tooltips showing exact values on hover

### Changed

- Donut chart enlarged for better readability (64px to 80px)
- Small percentages now show "<1%" instead of rounding to "0%"
- Busiest day count uses locale-formatted numbers
- Member since year shown in header badge
- Repo names use flex-based truncation instead of fixed max-width
- Removed unused organizations query from GraphQL (no longer needs read:org scope)

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

[1.1.0]: https://github.com/Sagargupta16/GitScope/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/Sagargupta16/GitScope/releases/tag/v1.0.0
