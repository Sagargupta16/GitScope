import { useState, useEffect } from "react";
import { useSearchParams } from "react-router";
import { fetchPublicProfile, fetchFullProfile } from "../lib/github";
import { formatNumber } from "../lib/analytics";
import { retryAuth, useAuth } from "../lib/auth";
import { LoginLink } from "../components/LoginLink";
import { useRequestGuard } from "../components/uiLifecycle";
import { LanguagesBar } from "../components/charts/LanguagesBar";
import type { ProfileStats, FullProfileStats } from "../lib/types";

function isFullStats(stats: ProfileStats): stats is FullProfileStats {
  return "totalContributions" in stats;
}

function ProfileCard({ stats }: { stats: ProfileStats }) {
  const { user, totalStars, topLanguages, originalRepos, forkedRepos, totalForksReceived, languageCount, accountAge, followerRatio } = stats;
  const joinYear = new Date(user.created_at).getFullYear();
  const full = isFullStats(stats) ? stats : null;

  return (
    <div className="rounded-lg border border-[var(--color-github-border)] bg-[var(--color-github-dark)] overflow-hidden flex-1 min-w-0">
      {/* Header */}
      <div className="p-4 flex items-center gap-3 border-b border-[var(--color-github-border)]">
        <img src={user.avatar_url} alt={user.login} className="w-12 h-12 rounded-full" />
        <div className="min-w-0">
          <a
            href={`https://github.com/${user.login}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-white font-semibold no-underline hover:underline block truncate"
          >
            {user.name || user.login}
          </a>
          <span className="text-sm text-[var(--color-github-muted)]">
            @{user.login} &middot; Since {joinYear} ({accountAge}y)
          </span>
        </div>
      </div>

      {/* Personality badge + quick stats (full only) */}
      {full && (
        <div className="px-4 py-2 border-b border-[var(--color-github-border)]">
          <div className="flex items-center justify-between mb-1">
            <div>
              <span className="text-sm font-semibold">{full.personality.label}</span>
              <span className="text-xs text-[var(--color-github-muted)] ml-2">{full.personality.description}</span>
            </div>
            {full.velocity.trend !== "neutral" && (
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                full.velocity.trend === "up"
                  ? "text-green-400 bg-green-950/40"
                  : "text-red-400 bg-red-950/40"
              }`}>
                {full.velocity.trend === "up" ? "\u25B2" : "\u25BC"} velocity
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5 mt-1">
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-[var(--color-github-muted)]">{full.avgPerDay}/active day</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-[var(--color-github-muted)]">{full.weekendPct}% weekends</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-[var(--color-github-muted)]">{languageCount} langs</span>
            {full.organizations > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-[var(--color-github-muted)]">{full.organizations} orgs</span>
            )}
          </div>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-px bg-[var(--color-github-border)]">
        {[
          { label: "Stars", value: formatNumber(totalStars) },
          { label: "Repos", value: formatNumber(user.public_repos) },
          { label: "Followers", value: formatNumber(user.followers) },
          ...(full
            ? [
                { label: "Rolling year", value: formatNumber(full.totalContributions) },
                { label: "Streak", value: `${full.currentStreak}d` },
                { label: "Best Streak", value: `${full.longestStreak}d` },
                { label: "Merged PRs", value: formatNumber(full.mergedPRs) },
                { label: "PR Rate", value: `${full.prMergeRate}%` },
                { label: "Issues", value: `${full.issueCloseRate}% closed` },
                { label: "Forks", value: formatNumber(totalForksReceived) },
                { label: "Contributed To", value: formatNumber(full.reposContributedTo) },
                { label: "Own/Fork", value: `${originalRepos}/${forkedRepos}` },
              ]
            : [
                { label: "Following", value: formatNumber(user.following) },
                { label: "Forks", value: formatNumber(totalForksReceived) },
                { label: "Own/Fork", value: `${originalRepos}/${forkedRepos}` },
                { label: "Ratio", value: followerRatio },
                { label: "Languages", value: String(languageCount) },
              ]),
        ].map((s) => (
          <div key={s.label} className="bg-[var(--color-github-dark)] p-3 text-center">
            <div className="text-lg font-bold">{s.value}</div>
            <div className="text-xs text-[var(--color-github-muted)]">{s.label}</div>
          </div>
        ))}
      </div>

      <LanguagesBar languages={topLanguages} totalCount={languageCount} />
    </div>
  );
}

function ComparisonTable({ left, right }: { left: ProfileStats; right: ProfileStats }) {
  const fullLeft = isFullStats(left) ? left : null;
  const fullRight = isFullStats(right) ? right : null;

  type Row = { label: string; l: number; r: number; fmt?: "pct" | "dec" };

  const rows: Row[] = [
    { label: "Stars", l: left.totalStars, r: right.totalStars },
    { label: "Repos", l: left.user.public_repos, r: right.user.public_repos },
    { label: "Followers", l: left.user.followers, r: right.user.followers },
    { label: "Original Repos", l: left.originalRepos, r: right.originalRepos },
    { label: "Forks Received", l: left.totalForksReceived, r: right.totalForksReceived },
    { label: "Languages", l: left.languageCount, r: right.languageCount },
    { label: "Account Age", l: left.accountAge, r: right.accountAge },
  ];

  if (fullLeft && fullRight) {
    rows.push(
      { label: "Contributions (rolling year)", l: fullLeft.totalContributions, r: fullRight.totalContributions },
      { label: "Current Streak", l: fullLeft.currentStreak, r: fullRight.currentStreak },
      { label: "Best Streak", l: fullLeft.longestStreak, r: fullRight.longestStreak },
      { label: "Merged PRs", l: fullLeft.mergedPRs, r: fullRight.mergedPRs },
      { label: "PR Merge Rate", l: fullLeft.prMergeRate, r: fullRight.prMergeRate, fmt: "pct" },
      { label: "Issue Close Rate", l: fullLeft.issueCloseRate, r: fullRight.issueCloseRate, fmt: "pct" },
      { label: "Avg/active day", l: fullLeft.avgPerDay, r: fullRight.avgPerDay, fmt: "dec" },
      { label: "Weekend %", l: fullLeft.weekendPct, r: fullRight.weekendPct, fmt: "pct" },
      { label: "Contributed To", l: fullLeft.reposContributedTo, r: fullRight.reposContributedTo },
      { label: "Organizations", l: fullLeft.organizations, r: fullRight.organizations },
    );
  }

  const leftWins = rows.filter((r) => r.l > r.r).length;
  const rightWins = rows.filter((r) => r.r > r.l).length;

  return (
    <div className="rounded-lg border border-[var(--color-github-border)] bg-[var(--color-github-dark)] overflow-hidden">
      {/* Score header */}
      <div className="flex items-center border-b border-[var(--color-github-border)] bg-[var(--color-github-darker)]">
        <div className="flex-1 min-w-0 break-all p-3 text-center">
          <span className="text-sm font-semibold">{left.user.login}</span>
        </div>
        <div className="px-4 py-3 text-center shrink-0">
          <span className="text-xl font-bold">
            <span className={leftWins > rightWins ? "text-[var(--color-brand)]" : ""}>{leftWins}</span>
            <span className="text-[var(--color-github-muted)] mx-1">-</span>
            <span className={rightWins > leftWins ? "text-[var(--color-brand)]" : ""}>{rightWins}</span>
          </span>
        </div>
        <div className="flex-1 min-w-0 break-all p-3 text-center">
          <span className="text-sm font-semibold">{right.user.login}</span>
        </div>
      </div>

      {rows.map((row) => {
        const leftWin = row.l > row.r;
        const rightWin = row.r > row.l;
        const fmtVal = (v: number) => {
          if (row.fmt === "pct") return `${v}%`;
          if (row.fmt === "dec") return v.toFixed(1);
          return formatNumber(v);
        };
        return (
          <div key={row.label} className="flex items-center border-b border-[var(--color-github-border)] last:border-0">
            <div className={`flex-1 p-3 text-right text-sm font-semibold ${leftWin ? "text-[var(--color-brand)]" : ""}`}>
              {fmtVal(row.l)}
              {leftWin && <span className="ml-1 text-xs">&#10003;</span>}
            </div>
            <div className="px-3 text-xs text-[var(--color-github-muted)] w-32 text-center shrink-0">
              {row.label}
            </div>
            <div className={`flex-1 p-3 text-left text-sm font-semibold ${rightWin ? "text-[var(--color-brand)]" : ""}`}>
              {rightWin && <span className="mr-1 text-xs">&#10003;</span>}
              {fmtVal(row.r)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function Compare() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [user1, setUser1] = useState(searchParams.get("user1") || "");
  const [user2, setUser2] = useState(searchParams.get("user2") || "");
  const [results, setResults] = useState<{ left: ProfileStats; right: ProfileStats } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { token, login, loading: authLoading, error: authError } = useAuth();
  const { start, cancel } = useRequestGuard(token, login);
  const [retry, setRetry] = useState(0);
  const [warning, setWarning] = useState<string | null>(null);
  const query1 = searchParams.get("user1")?.trim() ?? "";
  const query2 = searchParams.get("user2")?.trim() ?? "";

  useEffect(() => {
    setUser1(query1);
    setUser2(query2);
    setResults(null);
    setError(null);
    setWarning(null);
    if (authLoading || !query1 || !query2) { setLoading(false); return cancel; }
    const request = start();
    setLoading(true);
    let fallback = false;
    const fetcher = async (username: string) => {
      if (token) {
        try { return await fetchFullProfile(username, token, request.signal); }
        catch (error) {
          if (!request.current()) throw error;
          fallback = true;
        }
      }
      return fetchPublicProfile(username, request.signal);
    };
    Promise.all([fetcher(query1), fetcher(query2)])
      .then(([left, right]) => {
        if (!request.current()) return;
        setResults({ left, right });
        if (fallback || (token && (!isFullStats(left) || !isFullStats(right)))) {
          setWarning("Some contribution statistics are unavailable. Showing the public profile data that could be loaded.");
        }
      })
      .catch((err) => {
        if (request.current()) {
          setError(err instanceof Error ? err.message : "Comparison could not load");
          cancel();
          setLoading(false);
        }
      })
      .finally(() => { if (request.current()) setLoading(false); });
    return cancel;
  }, [query1, query2, token, authLoading, start, cancel, retry]);

  function handleCompare(event: React.FormEvent) {
    event.preventDefault();
    if (!user1.trim() || !user2.trim()) return;
    cancel();
    setResults(null);
    setSearchParams({ user1: user1.trim(), user2: user2.trim() });
    setRetry((value) => value + 1);
  }

  return (
    <section className="py-12 px-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-2">Compare GitHub Profiles</h1>
        <p className="text-center text-[var(--color-github-muted)] mb-2">Enter two GitHub usernames to see a side-by-side comparison.</p>
        {!token && !authLoading && <p className="text-center text-xs text-[var(--color-github-muted)] mb-6">
          <LoginLink returnTo={`/compare?${searchParams.toString()}`} className="text-[var(--color-brand-light)] hover:underline no-underline">Sign in with GitHub</LoginLink>
          {" "}for contribution stats: streaks, PRs, personality, and velocity.
        </p>}
        {token && <p className="text-center text-xs text-green-400 mb-6">
          Signed in{results && isFullStats(results.left) && isFullStats(results.right) && !warning ? " — contribution statistics loaded for both profiles." : "."}
        </p>}
        <p role="status" aria-live="polite" className="text-center text-sm text-[var(--color-github-muted)] mb-4">
          {authLoading ? "Checking sign-in…" : loading ? "Loading comparison…" : results ? "Comparison loaded. " : ""}{warning}
        </p>
        {authError && <div className="text-center mb-4">
          <p role="alert" className="text-red-400 mb-2">{authError}</p>
          <button type="button" onClick={() => void retryAuth()} disabled={authLoading}
            className="text-sm text-[var(--color-brand-light)] underline disabled:opacity-50">
            Retry verification
          </button>
        </div>}
        <form onSubmit={handleCompare} className="flex flex-col sm:flex-row items-center gap-3 mb-10">
          <label htmlFor="compare-user-1" className="sr-only">First GitHub username</label>
          <input id="compare-user-1" type="text" autoCapitalize="none" autoComplete="off" spellCheck={false} placeholder="Username 1" value={user1} onChange={(event) => setUser1(event.target.value)}
            className="flex-1 w-full sm:w-auto bg-[var(--color-github-dark)] border border-[var(--color-github-border)] rounded-lg px-4 py-2.5 text-white placeholder:text-[var(--color-github-muted)] focus:border-[var(--color-brand)] transition-colors" />
          <span className="text-[var(--color-github-muted)] font-bold text-lg">vs</span>
          <label htmlFor="compare-user-2" className="sr-only">Second GitHub username</label>
          <input id="compare-user-2" type="text" autoCapitalize="none" autoComplete="off" spellCheck={false} placeholder="Username 2" value={user2} onChange={(event) => setUser2(event.target.value)}
            className="flex-1 w-full sm:w-auto bg-[var(--color-github-dark)] border border-[var(--color-github-border)] rounded-lg px-4 py-2.5 text-white placeholder:text-[var(--color-github-muted)] focus:border-[var(--color-brand)] transition-colors" />
          <button type="submit" disabled={authLoading || !user1.trim() || !user2.trim()}
            className="bg-[var(--color-brand)] hover:bg-[var(--color-brand-light)] disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-lg font-semibold transition-colors whitespace-nowrap">
            {loading ? "Compare again" : "Compare"}
          </button>
        </form>
        {error && <div role="alert" className="text-center text-red-400 mb-6 p-4 rounded-lg border border-red-900 bg-red-950/30">{error}</div>}
        {results && <div className="space-y-6">
          <div className="flex flex-col md:flex-row gap-6"><ProfileCard stats={results.left} /><ProfileCard stats={results.right} /></div>
          <ComparisonTable left={results.left} right={results.right} />
          <p className="text-center text-xs text-[var(--color-github-muted)]">
            Share this comparison: <span className="text-[var(--color-github-text)] select-all break-all">
              {window.location.origin}{window.location.pathname}?{new URLSearchParams({ user1: results.left.user.login, user2: results.right.user.login }).toString()}
            </span>
          </p>
        </div>}
        {!results && !loading && !error && <div className="text-center text-[var(--color-github-muted)] py-12">
          <p className="text-lg mb-2">Enter two usernames to get started</p>
          <p className="text-sm">Try: <button type="button" onClick={() => { setUser1("torvalds"); setUser2("gvanrossum"); }} className="text-[var(--color-brand-light)] hover:underline bg-transparent border-none cursor-pointer">torvalds vs gvanrossum</button></p>
        </div>}
      </div>
    </section>
  );
}
