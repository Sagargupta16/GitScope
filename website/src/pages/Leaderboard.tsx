import { useState, useEffect, useCallback } from "react";
import { retryAuth, useAuth } from "../lib/auth";
import { LoginLink } from "../components/LoginLink";
import { useRequestGuard, accountCacheKey, readAccountCache, writeAccountCache } from "../components/uiLifecycle";
import { formatNumber } from "../lib/analytics";

import { fetchFollowing, fetchAllUsers, type LeaderboardEntry } from "../lib/leaderboard";

type SortKey = "totalStars" | "public_repos" | "followers" | "totalForks" | "languageCount";

const CACHE_TTL = 10 * 60 * 1000;

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span role="img" aria-label="Rank 1" className="text-lg" title="1st">&#129351;</span>;
  if (rank === 2) return <span role="img" aria-label="Rank 2" className="text-lg" title="2nd">&#129352;</span>;
  if (rank === 3) return <span role="img" aria-label="Rank 3" className="text-lg" title="3rd">&#129353;</span>;
  return <span className="text-sm text-[var(--color-github-muted)] font-mono w-6 text-center">#{rank}</span>;
}

function cacheAge(login: string, session: string): string | null {
  try {
    const cached = JSON.parse(localStorage.getItem(accountCacheKey("leaderboard", login, session)) ?? "null");
    const minutes = Math.round((Date.now() - cached.timestamp) / 60000);
    return Number.isFinite(minutes) ? minutes < 1 ? "just now" : `${minutes}m ago` : null;
  } catch { return null; }
}

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "totalStars", label: "Stars" },
  { key: "public_repos", label: "Repos" },
  { key: "followers", label: "Followers" },
  { key: "totalForks", label: "Forks" },
  { key: "languageCount", label: "Languages" },
];

export function Leaderboard() {
  const { token, login: viewerLogin, loading: authLoading, error: authError, signOut } = useAuth();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>("totalStars");
  const [fromCache, setFromCache] = useState(false);
  const { start, cancel, session } = useRequestGuard(token, viewerLogin);

  const loadLeaderboard = useCallback(async (forceRefresh = false) => {
    if (authLoading || !token || !viewerLogin) return;
    const request = start();
    const key = accountCacheKey("leaderboard", viewerLogin, session);
    setError(null);
    if (!forceRefresh) {
      const cached = readAccountCache<LeaderboardEntry[]>(key, viewerLogin, session, CACHE_TTL);
      if (Array.isArray(cached) && cached.some((entry) => entry.isViewer && entry.login.toLowerCase() === viewerLogin.toLowerCase())) {
        setEntries(cached);
        setFromCache(true);
        setLoading(false);
        return;
      }
    }
    setLoading(true);
    setEntries([]);
    setFromCache(false);
    setProgress("Fetching your following list…");
    try {
      const following = await fetchFollowing(token, request.signal);
      if (!request.current()) return;
      const allUsers = [...new Set([viewerLogin, ...following].map((name) => name.toLowerCase()))];
      const results = await fetchAllUsers(allUsers, token, viewerLogin, (message) => { if (request.current()) setProgress(message); }, request.signal);
      if (!request.current()) return;
      setEntries(results);
      writeAccountCache(key, viewerLogin, session, results);
    } catch (err) {
      if (request.current()) {
        setError(err instanceof Error ? err.message : "Leaderboard could not load");
        cancel();
        setLoading(false);
        setProgress("");
      }
    } finally {
      if (request.current()) { setLoading(false); setProgress(""); }
    }
  }, [authLoading, token, viewerLogin, start, cancel, session]);

  useEffect(() => {
    setEntries([]);
    void loadLeaderboard();
    return cancel;
  }, [loadLeaderboard, cancel]);

  const sorted = [...entries].sort((a, b) => b[sortBy] - a[sortBy] || a.login.localeCompare(b.login));
  const viewerRank = sorted.findIndex((e) => e.isViewer) + 1;
  const age = fromCache && viewerLogin ? cacheAge(viewerLogin, session) : null;

  function handleSignOut() {
    cancel();
    setEntries([]);
    setLoading(false);
    setError(null);
    signOut();
  }

  function handleRefresh() { void loadLeaderboard(true); }

  // Stat value for the expanded row
  function getStatValue(entry: LeaderboardEntry, key: SortKey): string {
    if (key === "totalStars") return formatNumber(entry.totalStars);
    if (key === "public_repos") return formatNumber(entry.public_repos);
    if (key === "followers") return formatNumber(entry.followers);
    if (key === "totalForks") return formatNumber(entry.totalForks);
    if (key === "languageCount") return String(entry.languageCount);
    return "";
  }

  return (
    <section className="py-12 px-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-2">Leaderboard</h1>
        <p className="text-center text-[var(--color-github-muted)] mb-8">
          See how you rank among the people you follow.
        </p>

        {/* Not authenticated */}
        {!authLoading && !token && (
          <div className="text-center py-16">
            <p className="text-[var(--color-github-muted)] mb-6">
              Sign in with GitHub to see your leaderboard. We'll compare your stats
              against everyone you follow.
            </p>
            <LoginLink
              returnTo="/leaderboard"
              className="inline-block bg-[var(--color-brand)] hover:bg-[var(--color-brand-light)] text-white px-6 py-3 rounded-lg font-semibold no-underline transition-colors"
            >
              Sign in with GitHub
            </LoginLink>
          </div>
        )}

        {/* Loading */}
        {(authLoading || loading) && (
          <div className="text-center py-16">
            <div className="inline-block w-8 h-8 border-2 border-[var(--color-github-border)] border-t-[var(--color-brand)] rounded-full animate-spin mb-4" />
            <p role="status" aria-live="polite" className="text-[var(--color-github-muted)] text-sm">{authLoading ? "Checking sign-in…" : progress}</p>
          </div>
        )}

        {token && (loading || error) && <div className="text-center mb-4">
          {error && <button onClick={handleRefresh} className="mr-4 text-sm">Try again</button>}
          <button onClick={handleSignOut} className="text-sm">Sign out</button>
        </div>}
        {authError && <div className="text-center mb-4">
          <p role="alert" className="text-red-400 mb-2">{authError}</p>
          <button type="button" onClick={() => void retryAuth()} disabled={authLoading}
            className="text-sm text-[var(--color-brand-light)] underline disabled:opacity-50">
            Retry verification
          </button>
        </div>}
        {/* Error */}
        {error && (
          <div role="alert" className="text-center text-red-400 mb-6 p-4 rounded-lg border border-red-900 bg-red-950/30">
            {error}
          </div>
        )}

        {/* Results */}
        {!loading && entries.length > 0 && (
          <>
            {/* Viewer rank highlight */}
            {viewerRank > 0 && (
              <div className="text-center mb-6 p-4 rounded-lg border border-[var(--color-github-border)] bg-[var(--color-github-dark)]">
                <span className="text-[var(--color-github-muted)]">Your rank: </span>
                <span className="text-2xl font-bold text-[var(--color-brand)]">
                  #{viewerRank}
                </span>
                <span className="text-[var(--color-github-muted)]"> of {entries.length}</span>
                <span className="text-[var(--color-github-muted)] ml-2">
                  (by {SORT_OPTIONS.find((o) => o.key === sortBy)?.label})
                </span>
              </div>
            )}

            {/* Sort controls */}
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-[var(--color-github-muted)]">Sort by:</span>
                {SORT_OPTIONS.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setSortBy(key)}
                    aria-pressed={sortBy === key}
                    className={`text-xs px-3 py-1 rounded-full border transition-colors cursor-pointer ${
                      sortBy === key
                        ? "border-[var(--color-brand)] text-[var(--color-brand)] bg-[var(--color-brand)]/10"
                        : "border-[var(--color-github-border)] text-[var(--color-github-muted)] hover:text-white bg-transparent"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3">
                {fromCache && (
                  <span className="text-[10px] text-[var(--color-github-muted)]">
                    cached {age ?? "this session"}
                  </span>
                )}
                <button
                  onClick={handleRefresh}
                  className="text-xs text-[var(--color-github-muted)] hover:text-white bg-transparent border-none cursor-pointer"
                >
                  Refresh
                </button>
                <button
                  onClick={handleSignOut}
                  className="text-xs text-[var(--color-github-muted)] hover:text-red-400 bg-transparent border-none cursor-pointer"
                >
                  Sign out
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="rounded-lg border border-[var(--color-github-border)] overflow-hidden">
              {/* Header */}
              <div className="hidden sm:flex items-center gap-3 px-4 py-2 bg-[var(--color-github-darker)] border-b border-[var(--color-github-border)] text-[10px] text-[var(--color-github-muted)] uppercase tracking-wide">
                <div className="w-8 text-center shrink-0">#</div>
                <div className="w-8 shrink-0" />
                <div className="flex-1">User</div>
                <div className="text-center min-w-[50px]">Stars</div>
                <div className="text-center min-w-[50px]">Repos</div>
                <div className="text-center min-w-[50px]">Followers</div>
                <div className="text-center min-w-[50px]">Forks</div>
                <div className="text-center min-w-[40px]">Langs</div>
              </div>

              {sorted.map((entry, i) => (
                <div
                  key={entry.login}
                  className={`leaderboard-row flex items-center gap-3 px-4 py-3 border-b border-[var(--color-github-border)] last:border-0 ${
                    entry.isViewer ? "bg-[var(--color-brand)]/5" : "bg-[var(--color-github-dark)]"
                  }`}
                >
                  <div className="w-8 flex justify-center shrink-0">
                    <RankBadge rank={i + 1} />
                  </div>
                  <img
                    src={entry.avatar_url}
                    alt={entry.login}
                    className="w-8 h-8 rounded-full shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <a
                      href={`https://github.com/${entry.login}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`text-sm font-semibold no-underline hover:underline truncate block ${
                        entry.isViewer ? "text-[var(--color-brand)]" : "text-white"
                      }`}
                    >
                      {entry.login}
                      {entry.isViewer && <span className="text-xs font-normal ml-1">(you)</span>}
                    </a>
                    {entry.name && (
                      <span className="text-xs text-[var(--color-github-muted)] truncate block">
                        {entry.name}
                      </span>
                    )}
                  </div>
                  <div className="leaderboard-metrics flex items-center gap-4 shrink-0 text-right">
                    {SORT_OPTIONS.map(({ key, label }) => (
                      <div key={key} className="text-center min-w-[50px]">
                        <div className={`text-sm font-semibold ${sortBy === key ? "text-[var(--color-brand)]" : ""}`}>
                          {getStatValue(entry, key)}
                        </div>
                        <div className="text-[10px] text-[var(--color-github-muted)]">{label.toLowerCase()}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer info */}
            <p role="status" aria-live="polite" className="text-center text-xs text-[var(--color-github-muted)] mt-4">
              {entries.length} users &middot; Data is cached for 10 minutes to avoid rate limits
            </p>
          </>
        )}
      </div>
    </section>
  );
}
