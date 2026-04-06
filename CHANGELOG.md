# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-04-06

### Added

#### Website
- **Dashboard** (`/dashboard`) - Personal analytics dashboard showing:
  - Profile overview with avatar, name, repos, followers, account age
  - Stat cards: total views, clones, stars, forks (with unique visitor/cloner counts)
  - Traffic area charts: daily views and clones over 14 days (total + unique)
  - Top repos bar chart by views, stars, or clones
  - Aggregated referrer chart across all repos
  - Sortable repository list with per-repo views, clones, stars, forks
  - "Sync Now" button for manual data refresh
  - 5-minute localStorage cache to avoid redundant API calls
- **Repo Detail** (`/dashboard/repo/:name`) - Per-repository analytics:
  - Repo stats: stars, forks, open issues, language
  - Traffic stats: total/unique views, total/unique clones, avg views/day
  - Views and clones area charts (14-day history)
  - Referrer chart and detailed referrer table
- **Chart components** (Recharts 3):
  - `TrafficAreaChart` - Dual-area chart for total + unique traffic
  - `TopReposBarChart` - Horizontal bar chart for top repos
  - `ReferrersChart` - Horizontal bar chart for traffic sources
  - `StatCard` - Reusable stat card with label, value, sub-value, trend
  - `Sparkline` - Inline mini chart for trend indicators
- Dashboard nav link in header (highlights for all `/dashboard/*` routes)

#### Worker
- `/web/login` now requests `repo` scope for traffic API access (extension `/login` unchanged at `read:user read:org`)

### Dependencies
- Added `recharts@3.8.1` (React charting library)
- Added `date-fns@4.1.0` (date formatting)

## [1.3.0] - 2026-04-03

### Added

#### Extension
- **PR merge rate** in stats grid (merged / total PRs percentage)
- **Forks received** stat showing total forks across all repos
- **Issue close rate** (closed / total issues percentage)
- **Weekend %** showing percentage of contributions on weekends
- **Language count** showing number of unique languages
- **Community & Impact** section: repos contributed to, organizations, follower ratio, account age
- More comparison metrics: forks received, followers in profile vs. you section

#### Website
- **Compare page** expanded with 17 head-to-head stats when signed in:
  - Forks received, languages, account age (always available)
  - PR merge rate, issue close rate, weekend %, contributed to, organizations (with auth)
- **Leaderboard** now shows 5 sortable columns: stars, repos, followers, forks, languages
- **Leaderboard caching** in localStorage (10-min TTL) to avoid rate limits on revisit
- **Batched API requests** in leaderboard (5 concurrent) for faster loading
- Profile cards show quick stat pills: avg/day, weekend %, language count, org count

### Changed

- Extension stats grid expanded from 6 to 9 cards (3x3 layout)
- Extension GraphQL query now fetches issue states, repos contributed to, and organizations
- Compare page comparison table widened for longer stat labels
- Leaderboard table has column headers and shows all stats per row
- Leaderboard sign-out also clears cached data

## [1.2.0] - 2026-04-03

### Added

- **Website** at [sagargupta16.github.io/GitScope](https://sagargupta16.github.io/GitScope/)
  - Landing page with feature showcase, screenshots, and Chrome Web Store install CTA
  - Compare tool: side-by-side GitHub profile comparison with head-to-head scoring
  - Leaderboard: rank yourself against everyone you follow (stars, repos, followers)
  - Privacy policy page (migrated from static HTML to React route)
  - Hybrid auth: basic stats without login (REST API), full stats with GitHub sign-in (GraphQL)
- Web OAuth flow via Cloudflare Worker using `state` parameter to share callback URL
- CLAUDE.md with project guidance for AI assistants

### Changed

- Cloudflare Worker now handles both extension and website OAuth flows through single `/callback` endpoint
- Updated README with website features, project structure, and dual tech stack docs
- Updated CONTRIBUTING.md with website and worker development instructions
- GitHub Pages workflow now builds React app with pnpm instead of serving static files

### Tech Stack (Website)

- React 19, TypeScript 6, Vite 8, Tailwind CSS v4, React Router v7

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

[2.0.0]: https://github.com/Sagargupta16/GitScope/compare/v1.3.0...v2.0.0
[1.3.0]: https://github.com/Sagargupta16/GitScope/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/Sagargupta16/GitScope/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/Sagargupta16/GitScope/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/Sagargupta16/GitScope/releases/tag/v1.0.0
