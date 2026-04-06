# Contributing to GitScope

Thanks for your interest in contributing!

## Getting Started

1. Fork and clone the repo
2. Install dependencies and build:
   ```bash
   # Extension
   npm install
   npm run build

   # Website
   cd website
   pnpm install
   pnpm dev
   ```
3. Load the extension in Chrome:
   - Go to `chrome://extensions`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the `dist/` folder
4. Visit any GitHub profile to see the extension in action

## Project Structure

- `src/` - Chrome extension (vanilla JS, esbuild)
- `website/` - Landing page + web tools (React 19, TypeScript, Vite, Tailwind CSS v4, Recharts 3)
- `website/src/components/charts/` - Reusable chart components for the dashboard (Recharts)
- `worker/` - Cloudflare Worker for OAuth (JS)
- `docs/` - Built website output (auto-generated, do not edit directly)

## Development

### Extension

- Edit files in `src/` and run `npm run build` (or `npm run watch` for auto-rebuild)
- CSS uses GitHub's CSS custom properties for theme compatibility
- All API calls go through `src/js/api.js` via the background service worker
- Charts are pure CSS/SVG in `src/js/charts.js` (no external charting libraries)

### Website

- Run `cd website && pnpm dev` for hot-reload dev server
- Pages are in `website/src/pages/` (Landing, Compare, Leaderboard, Dashboard, RepoDetail, Privacy)
- Chart components are in `website/src/components/charts/` (StatCard, TrafficAreaChart, TopReposBarChart, ReferrersChart, Sparkline)
- GitHub API logic is in `website/src/lib/github.ts`
- Dashboard API logic (traffic, repos) is in `website/src/lib/dashboard.ts`
- Analytics functions (ported from extension) are in `website/src/lib/analytics.ts`

### Worker

- Run `cd worker && npx wrangler dev` for local testing
- Handles both extension and website OAuth flows via the `state` parameter

## Pull Requests

- Link your PR to an existing issue if applicable
- Test on both light and dark GitHub themes
- Keep changes focused - one feature per PR
- Follow existing code style (vanilla JS for extension, TypeScript for website)
- Use conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`

## Reporting Issues

Use the [issue tracker](https://github.com/Sagargupta16/GitScope/issues) to report bugs or request features.
