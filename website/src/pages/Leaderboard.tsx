import { useState, useEffect, useCallback } from "react";
import {
  getStoredToken,
  getStoredLogin,
  storeAuth,
  clearAuth,
  getLoginUrl,
  extractTokenFromHash,
  fetchAuthenticatedUser,
} from "../lib/auth";
import { formatNumber } from "../lib/analytics";

interface LeaderboardEntry {
  login: string;
  name: string | null;
  avatar_url: string;
  public_repos: number;
  followers: number;
  public_gists: number;
  created_at: string;
  totalStars: number;
  isViewer: boolean;
}

type SortKey = "totalStars" | "public_repos" | "followers";

async function fetchUserWithStars(username: string, token: string): Promise<LeaderboardEntry | null> {
  const [userRes, reposRes] = await Promise.all([
    fetch(`https://api.github.com/users/${username}`, {
      headers: { Authorization: `bearer ${token}` },
    }),
    fetch(`https://api.github.com/users/${username}/repos?per_page=100&sort=stars&direction=desc`, {
      headers: { Authorization: `bearer ${token}` },
    }),
  ]);

  if (!userRes.ok) return null;

  const user = await userRes.json();
  const repos: { stargazers_count: number }[] = await reposRes.json();
  const totalStars = repos.reduce((sum, r) => sum + r.stargazers_count, 0);

  return {
    login: user.login,
    name: user.name,
    avatar_url: user.avatar_url,
    public_repos: user.public_repos,
    followers: user.followers,
    public_gists: user.public_gists,
    created_at: user.created_at,
    totalStars,
    isViewer: false,
  };
}

async function fetchFollowing(token: string): Promise<string[]> {
  const logins: string[] = [];
  let page = 1;
  while (page <= 5) {
    const res = await fetch(`https://api.github.com/user/following?per_page=100&page=${page}`, {
      headers: { Authorization: `bearer ${token}` },
    });
    const data: { login: string }[] = await res.json();
    if (data.length === 0) break;
    logins.push(...data.map((u) => u.login));
    if (data.length < 100) break;
    page++;
  }
  return logins;
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-lg" title="1st">&#129351;</span>;
  if (rank === 2) return <span className="text-lg" title="2nd">&#129352;</span>;
  if (rank === 3) return <span className="text-lg" title="3rd">&#129353;</span>;
  return <span className="text-sm text-[var(--color-github-muted)] font-mono w-6 text-center">#{rank}</span>;
}

export function Leaderboard() {
  const [token, setToken] = useState<string | null>(getStoredToken);
  const [viewerLogin, setViewerLogin] = useState<string | null>(getStoredLogin);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>("totalStars");

  // Handle OAuth redirect
  useEffect(() => {
    const hashToken = extractTokenFromHash();
    if (hashToken) {
      setToken(hashToken);
      fetchAuthenticatedUser(hashToken).then((login) => {
        storeAuth(hashToken, login);
        setViewerLogin(login);
      }).catch(() => {
        setError("Invalid token received. Please try signing in again.");
      });
    }

    // Check for auth error in hash
    const hash = window.location.hash;
    if (hash.includes("error=auth_failed")) {
      setError("Authentication failed. Please try again.");
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  const loadLeaderboard = useCallback(async () => {
    if (!token || !viewerLogin) return;

    setLoading(true);
    setError(null);
    setEntries([]);

    try {
      setProgress("Fetching your following list...");
      const following = await fetchFollowing(token);

      const allUsers = [viewerLogin, ...following];
      const results: LeaderboardEntry[] = [];

      for (let i = 0; i < allUsers.length; i++) {
        setProgress(`Fetching ${allUsers[i]} (${i + 1}/${allUsers.length})...`);
        const entry = await fetchUserWithStars(allUsers[i], token);
        if (entry) {
          entry.isViewer = allUsers[i] === viewerLogin;
          results.push(entry);
        }
      }

      setEntries(results);
      setProgress("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [token, viewerLogin]);

  // Auto-load when authenticated
  useEffect(() => {
    if (token && viewerLogin && entries.length === 0 && !loading) {
      loadLeaderboard();
    }
  }, [token, viewerLogin, entries.length, loading, loadLeaderboard]);

  const sorted = [...entries].sort((a, b) => b[sortBy] - a[sortBy]);
  const viewerRank = sorted.findIndex((e) => e.isViewer) + 1;

  function handleSignOut() {
    clearAuth();
    setToken(null);
    setViewerLogin(null);
    setEntries([]);
  }

  return (
    <section className="py-12 px-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-2">Leaderboard</h1>
        <p className="text-center text-[var(--color-github-muted)] mb-8">
          See how you rank among the people you follow.
        </p>

        {/* Not authenticated */}
        {!token && (
          <div className="text-center py-16">
            <p className="text-[var(--color-github-muted)] mb-6">
              Sign in with GitHub to see your leaderboard. We'll compare your stats
              against everyone you follow.
            </p>
            <a
              href={getLoginUrl()}
              className="inline-block bg-[var(--color-brand)] hover:bg-[var(--color-brand-light)] text-white px-6 py-3 rounded-lg font-semibold no-underline transition-colors"
            >
              Sign in with GitHub
            </a>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="text-center py-16">
            <div className="inline-block w-8 h-8 border-2 border-[var(--color-github-border)] border-t-[var(--color-brand)] rounded-full animate-spin mb-4" />
            <p className="text-[var(--color-github-muted)] text-sm">{progress}</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="text-center text-red-400 mb-6 p-4 rounded-lg border border-red-900 bg-red-950/30">
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
                  (by {sortBy === "totalStars" ? "stars" : sortBy === "public_repos" ? "repos" : "followers"})
                </span>
              </div>
            )}

            {/* Sort controls */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--color-github-muted)]">Sort by:</span>
                {([
                  ["totalStars", "Stars"],
                  ["public_repos", "Repos"],
                  ["followers", "Followers"],
                ] as const).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setSortBy(key)}
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
                <button
                  onClick={loadLeaderboard}
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
              {sorted.map((entry, i) => (
                <div
                  key={entry.login}
                  className={`flex items-center gap-3 px-4 py-3 border-b border-[var(--color-github-border)] last:border-0 ${
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
                  <div className="flex items-center gap-4 shrink-0 text-right">
                    <div className="text-center min-w-[50px]">
                      <div className={`text-sm font-semibold ${sortBy === "totalStars" ? "text-[var(--color-brand)]" : ""}`}>
                        {formatNumber(entry.totalStars)}
                      </div>
                      <div className="text-[10px] text-[var(--color-github-muted)]">stars</div>
                    </div>
                    <div className="text-center min-w-[50px]">
                      <div className={`text-sm font-semibold ${sortBy === "public_repos" ? "text-[var(--color-brand)]" : ""}`}>
                        {formatNumber(entry.public_repos)}
                      </div>
                      <div className="text-[10px] text-[var(--color-github-muted)]">repos</div>
                    </div>
                    <div className="text-center min-w-[50px]">
                      <div className={`text-sm font-semibold ${sortBy === "followers" ? "text-[var(--color-brand)]" : ""}`}>
                        {formatNumber(entry.followers)}
                      </div>
                      <div className="text-[10px] text-[var(--color-github-muted)]">followers</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
