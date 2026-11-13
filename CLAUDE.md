# CLAUDE.md

> This file stacks on top of the workspace root at `C:\Code\GitHub\`:
> - Root [`CLAUDE.md`](../../CLAUDE.md) -- voice, rules, routing map, references, skills, slash commands, conventions.
> - Root [`MEMORY.md`](../../MEMORY.md) -- live facts across repos.
> - Root [`STATUS.md`](../../STATUS.md) -- live PR/CI/security dashboard.
> - [`.claude/resources/`](../../.claude/resources/README.md) -- deep reference for collaboration, workflow, git, OSS, debugging, voice.
>
> Read those first. The guidance below only adds **repo-specific context** -- it does not override anything in the root.

# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project Overview

GitScope is a Chrome extension + website that adds contribution insights to GitHub profiles. Three main components:

1. **Chrome Extension** (`src/`) - Injects a dashboard into GitHub profile sidebars. Vanilla JS, esbuild bundler, Manifest V3.
2. **Website** (`website/`) - Landing page, profile comparison, leaderboard, and personal analytics dashboard. React 19 + TypeScript + Vite + Tailwind CSS v4 + Recharts 3.
3. **Cloudflare Worker** (`worker/`) - OAuth token exchange proxy. Handles both extension and website auth flows using a signed browser-bound OAuth state cookie and tab-bound website nonce. Website traffic upgrade requests `repo` scope explicitly.

## Architecture

- Extension uses GitHub GraphQL API via a background service worker (avoids CORS)
- Website uses GitHub REST API (no auth) for basic stats, GraphQL API (with auth) for full stats
- Dashboard uses GitHub REST API with `repo` scope for traffic data (views, clones, referrers)
- OAuth flow: GitHub -> Cloudflare Worker (`/callback`) -> extension (callback DOM capture) or website (state-validated hash redirect)
- Basic OAuth requests `read:user read:org`; website traffic analytics explicitly upgrades to `repo`
- Extension stores tokens in `chrome.storage.local` and migrates legacy sync tokens; website uses tab `sessionStorage`
- API responses cached in `chrome.storage.local` (extension) with 5-min TTL
- Dashboard data cached in `localStorage` with 5-min TTL; traffic fetches batched 5 repos at a time

## Common Commands

```bash
# Extension
npm install              # Install esbuild
npm run build            # Build to dist/
npm run watch            # Watch mode with sourcemaps

# Website
cd website
pnpm install             # Install React, Vite, Tailwind, etc.
pnpm dev                 # Dev server at localhost:5173
pnpm build               # Build to docs/ (GitHub Pages)

# Worker
cd worker
npx wrangler dev         # Local dev server
npx wrangler deploy      # Deploy to Cloudflare
```

## Key Patterns

- Extension charts are pure CSS/SVG in `src/js/charts.js` - no external charting libraries
- Website dashboard charts use Recharts 3 (`website/src/components/charts/`)
- Website ports the analytics functions from `charts.js` into `website/src/lib/analytics.ts`
- Dashboard API layer in `website/src/lib/dashboard.ts` handles traffic fetching with batched requests
- GitHub theme support via CSS custom properties (`--fgColor-default`, `--bgColor-muted`, etc.)
- Dark theme detection: `[data-color-mode="dark"]`, `[data-dark-theme="dark"]`, `@media (prefers-color-scheme: dark)`
- All extension DOM is prefixed with `gpi-` classes to avoid CSS conflicts
- Leaderboard data cached in `localStorage` with 10-min TTL to avoid GitHub API rate limits
- Dashboard data cached in `localStorage` with 5-min TTL; "Sync Now" button for manual refresh
- Extension GraphQL fetches core counts, paginated repositories, authenticated viewer identity, and four bounded contribution windows
- Achievements: definitions, tier thresholds and Octicon paths live once in `shared/achievements.json`, imported by `src/js/achievements.js` (extension) and `website/src/lib/achievements.ts`. GitHub publishes no thresholds; the official ones were checked against a live profile (Pull Shark 2,189 -> x4, Galaxy Brain 14 countable answers -> x2). Galaxy Brain excludes community/community (achievements off there, #106536) and self-asked discussions. The extension reads earned tiers from the profile page DOM (`img.achievement-badge-sidebar` plus `.achievement-tier-label`); the website cannot (no CORS on github.com), so it shows count-based tiers. All counts come from one batched GraphQL query plus one code search, loaded after the main panel

## Deployment

- **Extension**: Fully automated via release-please. Conventional commits on `main` drive an auto-maintained release PR (bumps `package.json` + `src/manifest.json` + CHANGELOG). Merging that PR tags the release and publishes to the Chrome Web Store. Never bump versions or push `v*` tags by hand.
- **Website**: Push to `main` (paths: `website/**`, `docs/**`) -> GitHub Actions builds React app + deploys to GitHub Pages
- **Worker**: Manual deploy via `cd worker && npx wrangler deploy`

## Conventions

- Vanilla JS for extension (no frameworks), TypeScript for website
- Conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`, `ci:`
- `pnpm` for website, `npm` for extension
- Do not edit `docs/` directly - it's auto-generated by `website/pnpm build`

## Reliability checks

Run `npm test`, `npm run typecheck`, `npm run build`, `npm run build:worker`, and `pnpm --dir website build`. Deploy the compatible Worker before merging client changes; Pages and extension publishing check `/health` for the `state-v1` protocol. Store upload failures are blocking. `scripts/check-production.mjs` verifies the website release SHA and served assets.
