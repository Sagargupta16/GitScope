import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { fetchPublicProfile } from "../lib/github";
import { formatNumber } from "../lib/analytics";
import type { ProfileStats } from "../lib/types";

function ProfileCard({ stats }: { stats: ProfileStats }) {
  const { user, totalStars, topLanguages, originalRepos, forkedRepos } = stats;
  const joinYear = new Date(user.created_at).getFullYear();

  return (
    <div className="rounded-lg border border-[var(--color-github-border)] bg-[var(--color-github-dark)] overflow-hidden flex-1 min-w-0">
      {/* Header */}
      <div className="p-4 flex items-center gap-3 border-b border-[var(--color-github-border)]">
        <img
          src={user.avatar_url}
          alt={user.login}
          className="w-12 h-12 rounded-full"
        />
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
            @{user.login} &middot; Since {joinYear}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-px bg-[var(--color-github-border)]">
        {[
          { label: "Stars", value: formatNumber(totalStars) },
          { label: "Repos", value: formatNumber(user.public_repos) },
          { label: "Followers", value: formatNumber(user.followers) },
          { label: "Following", value: formatNumber(user.following) },
          { label: "Original", value: String(originalRepos) },
          { label: "Forked", value: String(forkedRepos) },
        ].map((s) => (
          <div key={s.label} className="bg-[var(--color-github-dark)] p-3 text-center">
            <div className="text-lg font-bold">{s.value}</div>
            <div className="text-xs text-[var(--color-github-muted)]">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Languages */}
      {topLanguages.length > 0 && (
        <div className="p-4 border-t border-[var(--color-github-border)]">
          <div className="text-xs font-semibold text-[var(--color-github-muted)] uppercase tracking-wide mb-2">
            Languages
          </div>
          <div className="flex h-2 rounded overflow-hidden mb-2">
            {topLanguages.map((l) => (
              <div
                key={l.name}
                style={{ width: `${l.percentage}%`, backgroundColor: l.color }}
                title={`${l.name} ${l.percentage.toFixed(1)}%`}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {topLanguages.slice(0, 5).map((l) => (
              <span key={l.name} className="text-xs text-[var(--color-github-muted)] flex items-center gap-1">
                <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: l.color }} />
                {l.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ComparisonTable({ left, right }: { left: ProfileStats; right: ProfileStats }) {
  const rows = [
    { label: "Stars", l: left.totalStars, r: right.totalStars },
    { label: "Repos", l: left.user.public_repos, r: right.user.public_repos },
    { label: "Followers", l: left.user.followers, r: right.user.followers },
    { label: "Original Repos", l: left.originalRepos, r: right.originalRepos },
  ];

  return (
    <div className="rounded-lg border border-[var(--color-github-border)] bg-[var(--color-github-dark)] overflow-hidden">
      <div className="p-3 border-b border-[var(--color-github-border)] bg-[var(--color-github-darker)]">
        <h3 className="text-sm font-semibold text-center">Head to Head</h3>
      </div>
      {rows.map((row) => {
        const leftWins = row.l > row.r;
        const rightWins = row.r > row.l;
        return (
          <div key={row.label} className="flex items-center border-b border-[var(--color-github-border)] last:border-0">
            <div className={`flex-1 p-3 text-right text-sm font-semibold ${leftWins ? "text-[var(--color-brand)]" : ""}`}>
              {formatNumber(row.l)}
            </div>
            <div className="px-3 text-xs text-[var(--color-github-muted)] w-28 text-center shrink-0">
              {row.label}
            </div>
            <div className={`flex-1 p-3 text-left text-sm font-semibold ${rightWins ? "text-[var(--color-brand)]" : ""}`}>
              {formatNumber(row.r)}
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

  async function handleCompare(e: React.FormEvent) {
    e.preventDefault();
    const u1 = user1.trim();
    const u2 = user2.trim();
    if (!u1 || !u2) return;

    setLoading(true);
    setError(null);
    setResults(null);
    setSearchParams({ user1: u1, user2: u2 });

    try {
      const [left, right] = await Promise.all([
        fetchPublicProfile(u1),
        fetchPublicProfile(u2),
      ]);
      setResults({ left, right });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="py-12 px-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-2">Compare GitHub Profiles</h1>
        <p className="text-center text-[var(--color-github-muted)] mb-8">
          Enter two GitHub usernames to see a side-by-side comparison.
        </p>

        {/* Form */}
        <form onSubmit={handleCompare} className="flex flex-col sm:flex-row items-center gap-3 mb-10">
          <input
            type="text"
            placeholder="Username 1"
            value={user1}
            onChange={(e) => setUser1(e.target.value)}
            className="flex-1 w-full sm:w-auto bg-[var(--color-github-dark)] border border-[var(--color-github-border)] rounded-lg px-4 py-2.5 text-white placeholder:text-[var(--color-github-muted)] outline-none focus:border-[var(--color-brand)] transition-colors"
          />
          <span className="text-[var(--color-github-muted)] font-bold text-lg">vs</span>
          <input
            type="text"
            placeholder="Username 2"
            value={user2}
            onChange={(e) => setUser2(e.target.value)}
            className="flex-1 w-full sm:w-auto bg-[var(--color-github-dark)] border border-[var(--color-github-border)] rounded-lg px-4 py-2.5 text-white placeholder:text-[var(--color-github-muted)] outline-none focus:border-[var(--color-brand)] transition-colors"
          />
          <button
            type="submit"
            disabled={loading || !user1.trim() || !user2.trim()}
            className="bg-[var(--color-brand)] hover:bg-[var(--color-brand-light)] disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-lg font-semibold transition-colors whitespace-nowrap"
          >
            {loading ? "Loading..." : "Compare"}
          </button>
        </form>

        {/* Error */}
        {error && (
          <div className="text-center text-red-400 mb-6 p-4 rounded-lg border border-red-900 bg-red-950/30">
            {error}
          </div>
        )}

        {/* Results */}
        {results && (
          <div className="space-y-6">
            {/* Profile Cards */}
            <div className="flex flex-col md:flex-row gap-6">
              <ProfileCard stats={results.left} />
              <ProfileCard stats={results.right} />
            </div>

            {/* Comparison Table */}
            <ComparisonTable left={results.left} right={results.right} />

            {/* Share hint */}
            <p className="text-center text-xs text-[var(--color-github-muted)]">
              Share this comparison:{" "}
              <span className="text-[var(--color-github-text)] select-all">
                {window.location.href}
              </span>
            </p>
          </div>
        )}

        {/* Empty state */}
        {!results && !loading && !error && (
          <div className="text-center text-[var(--color-github-muted)] py-12">
            <p className="text-lg mb-2">Enter two usernames to get started</p>
            <p className="text-sm">
              Try: <button type="button" onClick={() => { setUser1("torvalds"); setUser2("gvanrossum"); }} className="text-[var(--color-brand)] hover:underline bg-transparent border-none cursor-pointer">torvalds vs gvanrossum</button>
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
