# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.1](https://github.com/Sagargupta16/GitScope/compare/v1.2.0...v1.2.1) (2026-09-02)


### Bug Fixes

* **deps:** bump postcss to 8.5.26 to patch source map path traversal ([#49](https://github.com/Sagargupta16/GitScope/issues/49)) ([b2f9d4f](https://github.com/Sagargupta16/GitScope/commit/b2f9d4f3794014836bf408faab1838cab46c22bd))

## [1.2.0](https://github.com/Sagargupta16/GitScope/compare/v1.1.0...v1.2.0) (2026-07-21)


### Features

* add comprehensive stats across extension, website, and leaderboard ([cc7c285](https://github.com/Sagargupta16/GitScope/commit/cc7c2858dfc5904898febc11334f450c45348a94))
* add landing page and GitHub profile comparison tool ([2831102](https://github.com/Sagargupta16/GitScope/commit/283110205d9635c5ae1c672c3e9ed049bb2bb9a6))
* add leaderboard page with GitHub OAuth and ranking ([6e5c3ce](https://github.com/Sagargupta16/GitScope/commit/6e5c3ce1f57b81a8e81947c7fd4e1522297a362a))
* add personal analytics dashboard with traffic data ([3c6aab6](https://github.com/Sagargupta16/GitScope/commit/3c6aab61089a10b9e40c598ff2a18816f001d3e0))
* add personal analytics dashboard with traffic data (v2.0.0) ([0edb05f](https://github.com/Sagargupta16/GitScope/commit/0edb05fb3c5e3226f13e48a6adb4355f8cd49e45))
* add profile stats, languages, commit activity, and rich repo detail ([e1b644b](https://github.com/Sagargupta16/GitScope/commit/e1b644b9c07637fdde0276ce6c811bf3ef0456b0))
* comprehensive stats across extension, website, and leaderboard ([38aa14e](https://github.com/Sagargupta16/GitScope/commit/38aa14ed06b62ce133fbe5e25856fc75292f3a54))
* enhanced compare page with full stats and head-to-head scoring ([3a0e50e](https://github.com/Sagargupta16/GitScope/commit/3a0e50ed0c0c4bf59c3e70163b5ecde095a2718d))
* landing page and GitHub profile comparison tool ([4838aa6](https://github.com/Sagargupta16/GitScope/commit/4838aa6bbb6ea44e126cd9cee09865f0b267c75e))
* leaderboard page with ranking among followed users ([7ff0df5](https://github.com/Sagargupta16/GitScope/commit/7ff0df5c126f5378ff202867e700bf9f2f4f40ce))


### Bug Fixes

* **ci:** grant deploy job pages+id-token permissions ([bad929b](https://github.com/Sagargupta16/GitScope/commit/bad929bbba2fd4ff19e1fff678d402245a860430))
* **ci:** grant Pages deploy job the required permissions ([1622050](https://github.com/Sagargupta16/GitScope/commit/16220501da04d6b2f62086e5e8f0c51749b50ac0))
* **ci:** move permissions to job level (SonarCloud S8233/S8264) ([677bc10](https://github.com/Sagargupta16/GitScope/commit/677bc10a5d35fd69dbb5b7cb181b6b6043cba4f7))
* current-streak calc breaks on trailing empty day ([#39](https://github.com/Sagargupta16/GitScope/issues/39)) ([5acdf39](https://github.com/Sagargupta16/GitScope/commit/5acdf39d9295d535fd5c12e23b506768892f4617))
* **deps:** upgrade vite to patch high-severity vulnerabilities and add workspace preamble ([c96f718](https://github.com/Sagargupta16/GitScope/commit/c96f718110c026b306c59e2e2232eb0eee21ea4e))
* normalize GitHub traffic API timestamp field to date ([c0d264d](https://github.com/Sagargupta16/GitScope/commit/c0d264d4b700dabffaca2e0b9db4c042d280b023))
* read popup version from manifest and align version sources ([#42](https://github.com/Sagargupta16/GitScope/issues/42)) ([34de6e4](https://github.com/Sagargupta16/GitScope/commit/34de6e43683ee75c9464493a924c00c4f5ae6da0))
* resolve vite security vulnerabilities via npm audit fix ([86d5df8](https://github.com/Sagargupta16/GitScope/commit/86d5df8fac157652db8adb5124c552ddc755e381))
* split profile query to avoid GitHub resource limits ([#41](https://github.com/Sagargupta16/GitScope/issues/41)) ([4353dc7](https://github.com/Sagargupta16/GitScope/commit/4353dc720e480bd1e91db18d84332fc9d06764b5))
* use localeCompare in year sort for consistent ordering ([7d86d6b](https://github.com/Sagargupta16/GitScope/commit/7d86d6be88ea19c28b8cf70eb42284168df46412))
* use plain v-prefixed tags for release-please ([#45](https://github.com/Sagargupta16/GitScope/issues/45)) ([51fe3c7](https://github.com/Sagargupta16/GitScope/commit/51fe3c755b47d6310f454b5c9964769e0606c383))
* use registered callback URL with state param for web OAuth flow ([8bbfa23](https://github.com/Sagargupta16/GitScope/commit/8bbfa23392e4088187116015c148b41e8f36ee74))

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
