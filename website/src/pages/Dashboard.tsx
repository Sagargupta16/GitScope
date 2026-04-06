import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import {
  getStoredToken,
  getStoredLogin,
  storeAuth,
  clearAuth,
  getLoginUrl,
  extractTokenFromHash,
  fetchAuthenticatedUser,
} from "../lib/auth";
import { fetchDashboardData } from "../lib/dashboard";
import { formatNumber } from "../lib/analytics";
import type { DashboardData, DashboardRepo } from "../lib/types";
import { StatCard } from "../components/charts/StatCard";
import { TrafficAreaChart } from "../components/charts/TrafficAreaChart";
import { TopReposBarChart } from "../components/charts/TopReposBarChart";
import { ReferrersChart } from "../components/charts/ReferrersChart";
import { LanguagesBar } from "../components/charts/LanguagesBar";

type RepoSortKey = "totalViews" | "stargazers_count" | "totalClones" | "forks_count";

const CACHE_KEY = "gitscope_dashboard";
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface CachedDashboard {
  data: DashboardData;
  timestamp: number;
}

function loadCache(): DashboardData | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached: CachedDashboard = JSON.parse(raw);
    if (Date.now() - cached.timestamp > CACHE_TTL) return null;
    return cached.data;
  } catch {
    return null;
  }
}

function saveCache(data: DashboardData) {
  localStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
}

const SORT_OPTIONS: { key: RepoSortKey; label: string }[] = [
  { key: "totalViews", label: "Views" },
  { key: "stargazers_count", label: "Stars" },
  { key: "totalClones", label: "Clones" },
  { key: "forks_count", label: "Forks" },
];

function RepoRow({ repo, sortBy }: { repo: DashboardRepo; sortBy: RepoSortKey }) {
  return (
    <Link
      to={`/dashboard/repo/${repo.name}`}
      className="flex items-center gap-4 px-4 py-3 border-b border-[var(--color-github-border)] last:border-0 bg-[var(--color-github-dark)] hover:bg-[var(--color-github-darker)] transition-colors no-underline text-inherit"
    >
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-white truncate">{repo.name}</div>
        {repo.description && (
          <div className="text-xs text-[var(--color-github-muted)] truncate mt-0.5">
            {repo.description}
          </div>
        )}
      </div>
      <div className="flex items-center gap-4 shrink-0 text-right">
        {repo.language && (
          <span className="text-xs text-[var(--color-github-muted)] hidden sm:inline">
            {repo.language}
          </span>
        )}
        <div className="text-center min-w-[50px]">
          <div className={`text-sm font-semibold ${sortBy === "stargazers_count" ? "text-[var(--color-brand)]" : ""}`}>
            {formatNumber(repo.stargazers_count)}
          </div>
          <div className="text-[10px] text-[var(--color-github-muted)]">stars</div>
        </div>
        <div className="text-center min-w-[50px]">
          <div className={`text-sm font-semibold ${sortBy === "forks_count" ? "text-[var(--color-brand)]" : ""}`}>
            {formatNumber(repo.forks_count)}
          </div>
          <div className="text-[10px] text-[var(--color-github-muted)]">forks</div>
        </div>
        <div className="text-center min-w-[50px]">
          <div className={`text-sm font-semibold ${sortBy === "totalViews" ? "text-[var(--color-brand)]" : ""}`}>
            {formatNumber(repo.totalViews)}
          </div>
          <div className="text-[10px] text-[var(--color-github-muted)]">views</div>
        </div>
        <div className="text-center min-w-[50px]">
          <div className={`text-sm font-semibold ${sortBy === "totalClones" ? "text-[var(--color-brand)]" : ""}`}>
            {formatNumber(repo.totalClones)}
          </div>
          <div className="text-[10px] text-[var(--color-github-muted)]">clones</div>
        </div>
      </div>
      <svg viewBox="0 0 16 16" width="14" height="14" className="text-[var(--color-github-muted)] shrink-0">
        <path fill="currentColor" d="M6.22 3.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 010-1.06z" />
      </svg>
    </Link>
  );
}

export function Dashboard() {
  const [token, setToken] = useState<string | null>(getStoredToken);
  const [viewerLogin, setViewerLogin] = useState<string | null>(getStoredLogin);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<RepoSortKey>("totalViews");
  const loadedRef = useRef(false);

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

    const hash = globalThis.location.hash;
    if (hash.includes("error=auth_failed")) {
      setError("Authentication failed. Please try again.");
      globalThis.history.replaceState(null, "", globalThis.location.pathname);
    }
  }, []);

  const loadDashboard = useCallback(async (forceRefresh = false) => {
    if (!token) return;

    if (!forceRefresh) {
      const cached = loadCache();
      if (cached) {
        setData(cached);
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      const result = await fetchDashboardData(token, setProgress);
      setData(result);
      saveCache(result);
      setProgress("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Auto-load on auth
  useEffect(() => {
    if (token && !loadedRef.current) {
      loadedRef.current = true;
      loadDashboard();
    }
  }, [token, loadDashboard]);

  function handleSignOut() {
    clearAuth();
    localStorage.removeItem(CACHE_KEY);
    setToken(null);
    setViewerLogin(null);
    setData(null);
    loadedRef.current = false;
  }

  function handleSync() {
    localStorage.removeItem(CACHE_KEY);
    loadDashboard(true);
  }

  // Not authenticated
  if (!token) {
    return (
      <section className="py-20 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-3xl font-bold mb-4">Dashboard</h1>
          <p className="text-[var(--color-github-muted)] mb-2">
            See your GitHub traffic, star trends, and repo analytics in one place.
          </p>
          <p className="text-xs text-[var(--color-github-muted)] mb-8">
            Requires <code className="bg-[var(--color-github-dark)] px-1 rounded">repo</code> scope
            to read traffic data. GitScope only reads traffic stats -- it never writes to your repos.
          </p>
          <a
            href={getLoginUrl()}
            className="inline-block bg-[var(--color-brand)] hover:bg-[var(--color-brand-light)] text-white px-6 py-3 rounded-lg font-semibold no-underline transition-colors"
          >
            Sign in with GitHub
          </a>
        </div>
      </section>
    );
  }

  // Loading
  if (loading) {
    return (
      <section className="py-20 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <div className="inline-block w-8 h-8 border-2 border-[var(--color-github-border)] border-t-[var(--color-brand)] rounded-full animate-spin mb-4" />
          <p className="text-[var(--color-github-muted)] text-sm">{progress}</p>
        </div>
      </section>
    );
  }

  // Error
  if (error) {
    return (
      <section className="py-20 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <div className="text-red-400 mb-6 p-4 rounded-lg border border-red-900 bg-red-950/30">
            {error}
          </div>
          <button
            onClick={handleSync}
            className="bg-[var(--color-brand)] hover:bg-[var(--color-brand-light)] text-white px-4 py-2 rounded-lg text-sm cursor-pointer border-none"
          >
            Try again
          </button>
        </div>
      </section>
    );
  }

  if (!data) return null;

  const sortedRepos = [...data.repos].sort((a, b) => b[sortBy] - a[sortBy]);
  const joinYear = new Date(data.user.created_at).getFullYear();
  const accountAge = new Date().getFullYear() - joinYear;

  return (
    <section className="py-8 px-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <img
              src={data.user.avatar_url}
              alt={data.user.login}
              className="w-14 h-14 rounded-full"
            />
            <div>
              <h1 className="text-2xl font-bold">{data.user.name || data.user.login}</h1>
              <div className="text-sm text-[var(--color-github-muted)]">
                @{data.user.login} &middot; {data.user.public_repos} repos &middot; {data.user.followers} followers &middot; {accountAge}yr
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSync}
              className="text-xs bg-[var(--color-brand)] hover:bg-[var(--color-brand-light)] text-white px-4 py-2 rounded-md cursor-pointer border-none transition-colors"
            >
              Sync Now
            </button>
            <button
              onClick={handleSignOut}
              className="text-xs text-[var(--color-github-muted)] hover:text-red-400 bg-transparent border-none cursor-pointer"
            >
              Sign out
            </button>
          </div>
        </div>

        {/* Profile stats (from GraphQL) */}
        {data.profile && (
          <div className="rounded-lg border border-[var(--color-github-border)] bg-[var(--color-github-dark)] p-4 mb-8">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold">{data.profile.personality.label}</span>
                <span className="text-xs text-[var(--color-github-muted)]">{data.profile.personality.description}</span>
              </div>
              {data.profile.velocity.trend !== "neutral" && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  data.profile.velocity.trend === "up"
                    ? "text-green-400 bg-green-950/40"
                    : "text-red-400 bg-red-950/40"
                }`}>
                  {data.profile.velocity.trend === "up" ? "\u25B2" : "\u25BC"} velocity ({data.profile.velocity.ratio.toFixed(1)}x)
                </span>
              )}
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
              <div className="text-center">
                <div className="text-lg font-bold">{formatNumber(data.profile.totalContributions)}</div>
                <div className="text-[10px] text-[var(--color-github-muted)]">This Year</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold">{data.profile.currentStreak}d</div>
                <div className="text-[10px] text-[var(--color-github-muted)]">Streak</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold">{data.profile.longestStreak}d</div>
                <div className="text-[10px] text-[var(--color-github-muted)]">Best Streak</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold">{formatNumber(data.profile.mergedPRs)}</div>
                <div className="text-[10px] text-[var(--color-github-muted)]">Merged PRs</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold">{data.profile.prMergeRate}%</div>
                <div className="text-[10px] text-[var(--color-github-muted)]">PR Rate</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold">{data.profile.issueCloseRate}%</div>
                <div className="text-[10px] text-[var(--color-github-muted)]">Issues Closed</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold">{data.profile.avgPerDay}</div>
                <div className="text-[10px] text-[var(--color-github-muted)]">Avg/Day</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold">{data.profile.weekendPct}%</div>
                <div className="text-[10px] text-[var(--color-github-muted)]">Weekends</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              <span className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-[var(--color-github-muted)]">{formatNumber(data.profile.reposContributedTo)} repos contributed to</span>
              {data.profile.organizations > 0 && (
                <span className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-[var(--color-github-muted)]">{data.profile.organizations} organizations</span>
              )}
              <span className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-[var(--color-github-muted)]">{data.profile.openPRs} open PRs</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-[var(--color-github-muted)]">{data.profile.closedIssues + data.profile.openIssues} total issues</span>
            </div>
          </div>
        )}

        {/* Languages */}
        {data.profile && data.profile.topLanguages.length > 0 && (
          <div className="mb-8">
            <LanguagesBar languages={data.profile.topLanguages} totalCount={data.profile.languageCount} />
          </div>
        )}

        {/* Traffic stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Views (14d)"
            value={formatNumber(data.totalViews)}
            subValue={`${formatNumber(data.totalUniqueVisitors)} unique visitors`}
          />
          <StatCard
            label="Clones (14d)"
            value={formatNumber(data.totalClones)}
            subValue={`${formatNumber(data.totalUniqueCloners)} unique cloners`}
          />
          <StatCard
            label="Total Stars"
            value={formatNumber(data.totalStars)}
            subValue={`across ${data.repos.length} repos`}
          />
          <StatCard
            label="Total Forks"
            value={formatNumber(data.totalForks)}
            subValue={`${data.repos.filter((r) => r.forks_count > 0).length} repos forked`}
          />
        </div>

        {/* Traffic charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
          <TrafficAreaChart data={data.viewsTimeline} title="Views (last 14 days)" />
          <TrafficAreaChart
            data={data.clonesTimeline}
            title="Clones (last 14 days)"
            color="#da3633"
            secondaryColor="#f0883e"
          />
        </div>

        {/* Top repos + referrers */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
          <TopReposBarChart repos={data.repos} dataKey="totalViews" title="Top Repos by Views" />
          <ReferrersChart referrers={data.referrers} />
        </div>

        {/* Star chart */}
        <div className="mb-8">
          <TopReposBarChart
            repos={data.repos}
            dataKey="stargazers_count"
            title="Top Repos by Stars"
            color="#e3b341"
          />
        </div>

        {/* Repository list */}
        <div className="rounded-lg border border-[var(--color-github-border)] overflow-hidden mb-4">
          {/* List header */}
          <div className="flex items-center justify-between px-4 py-3 bg-[var(--color-github-darker)] border-b border-[var(--color-github-border)]">
            <h2 className="text-sm font-semibold">Repositories ({data.repos.length})</h2>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[var(--color-github-muted)]">Sort:</span>
              {SORT_OPTIONS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setSortBy(key)}
                  className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors cursor-pointer ${
                    sortBy === key
                      ? "border-[var(--color-brand)] text-[var(--color-brand)] bg-[var(--color-brand)]/10"
                      : "border-[var(--color-github-border)] text-[var(--color-github-muted)] hover:text-white bg-transparent"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {sortedRepos.map((repo) => (
            <RepoRow key={repo.name} repo={repo} sortBy={sortBy} />
          ))}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-[var(--color-github-muted)]">
          Traffic data from GitHub API (last 14 days) &middot; Last synced:{" "}
          {new Date(data.lastSynced).toLocaleString()}
        </p>
      </div>
    </section>
  );
}
