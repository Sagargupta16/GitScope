import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { getStoredToken, getStoredLogin, getLoginUrl } from "../lib/auth";
import { fetchRepoDetail } from "../lib/dashboard";
import { formatNumber } from "../lib/analytics";
import type { RepoDetailData } from "../lib/types";
import { StatCard } from "../components/charts/StatCard";
import { TrafficAreaChart } from "../components/charts/TrafficAreaChart";
import { ReferrersChart } from "../components/charts/ReferrersChart";
import { CommitActivityChart } from "../components/charts/CommitActivityChart";
import { ParticipationChart } from "../components/charts/ParticipationChart";
import { format } from "date-fns";

function formatSize(kb: number): string {
  if (kb >= 1024 * 1024) return `${(kb / (1024 * 1024)).toFixed(1)} GB`;
  if (kb >= 1024) return `${(kb / 1024).toFixed(1)} MB`;
  return `${kb} KB`;
}

export function RepoDetail() {
  const { name } = useParams<{ name: string }>();
  const token = getStoredToken();
  const login = getStoredLogin();
  const [data, setData] = useState<RepoDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!token || !login || !name || loadedRef.current) return;
    loadedRef.current = true;

    fetchRepoDetail(login, name, token)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load repo data"))
      .finally(() => setLoading(false));
  }, [token, login, name]);

  if (!token) {
    return (
      <section className="py-20 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-3xl font-bold mb-4">{name}</h1>
          <p className="text-[var(--color-github-muted)] mb-8">
            Sign in to view traffic analytics for this repository.
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

  if (loading) {
    return (
      <section className="py-20 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <div className="inline-block w-8 h-8 border-2 border-[var(--color-github-border)] border-t-[var(--color-brand)] rounded-full animate-spin mb-4" />
          <p className="text-[var(--color-github-muted)] text-sm">Loading {name}...</p>
        </div>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className="py-20 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <div className="text-red-400 mb-6 p-4 rounded-lg border border-red-900 bg-red-950/30">
            {error ?? "Failed to load data"}
          </div>
          <Link
            to="/dashboard"
            className="text-[var(--color-brand)] hover:underline no-underline text-sm"
          >
            Back to Dashboard
          </Link>
        </div>
      </section>
    );
  }

  const { info, traffic, commitActivity, participation } = data;
  const createdDate = info.created_at ? format(new Date(info.created_at), "MMM d, yyyy") : null;
  const pushedDate = info.pushed_at ? format(new Date(info.pushed_at), "MMM d, yyyy") : null;
  const totalCommits = participation ? participation.owner.reduce((s, n) => s + n, 0) : null;
  const totalAllCommits = participation ? participation.all.reduce((s, n) => s + n, 0) : null;

  return (
    <section className="py-8 px-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div>
            <Link
              to="/dashboard"
              className="text-xs text-[var(--color-github-muted)] hover:text-white no-underline transition-colors"
            >
              &larr; Back to Dashboard
            </Link>
            <h1 className="text-2xl font-bold mt-1">{name}</h1>
            {info.description && (
              <p className="text-sm text-[var(--color-github-muted)] mt-1">{info.description}</p>
            )}
          </div>
          <a
            href={info.html_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[var(--color-github-muted)] hover:text-white no-underline transition-colors"
          >
            View on GitHub &rarr;
          </a>
        </div>

        {/* Topics */}
        {info.topics.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {info.topics.map((topic) => (
              <span
                key={topic}
                className="text-xs px-2.5 py-0.5 rounded-full bg-[var(--color-brand)]/15 text-[var(--color-brand)] border border-[var(--color-brand)]/30"
              >
                {topic}
              </span>
            ))}
          </div>
        )}

        {/* Repo metadata */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
          <StatCard label="Stars" value={formatNumber(info.stargazers_count)} />
          <StatCard label="Forks" value={formatNumber(info.forks_count)} />
          <StatCard label="Open Issues" value={formatNumber(info.open_issues_count)} />
          {info.language && <StatCard label="Language" value={info.language} />}
          <StatCard label="Size" value={formatSize(info.size)} />
          {info.license && <StatCard label="License" value={info.license} />}
        </div>

        {/* Repo info pills */}
        <div className="flex flex-wrap gap-2 mb-8">
          {createdDate && (
            <span className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-[var(--color-github-muted)]">
              Created {createdDate}
            </span>
          )}
          {pushedDate && (
            <span className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-[var(--color-github-muted)]">
              Last push {pushedDate}
            </span>
          )}
          <span className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-[var(--color-github-muted)]">
            {info.default_branch} branch
          </span>
          {info.watchers_count > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-[var(--color-github-muted)]">
              {info.watchers_count} watchers
            </span>
          )}
          {info.subscribers_count > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-[var(--color-github-muted)]">
              {info.subscribers_count} subscribers
            </span>
          )}
          {info.has_pages && (
            <span className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-[var(--color-github-muted)]">
              GitHub Pages
            </span>
          )}
          {info.has_wiki && (
            <span className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-[var(--color-github-muted)]">
              Wiki
            </span>
          )}
          {totalCommits !== null && (
            <span className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-[var(--color-github-muted)]">
              {totalCommits} your commits (of {totalAllCommits} total)
            </span>
          )}
        </div>

        {/* Traffic stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Total Views"
            value={formatNumber(traffic.views.count)}
            subValue={`${formatNumber(traffic.views.uniques)} unique`}
          />
          <StatCard
            label="Total Clones"
            value={formatNumber(traffic.clones.count)}
            subValue={`${formatNumber(traffic.clones.uniques)} unique`}
          />
          <StatCard
            label="Avg Views/Day"
            value={
              traffic.views.views.length > 0
                ? (traffic.views.count / traffic.views.views.length).toFixed(1)
                : "0"
            }
          />
          <StatCard
            label="Referrers"
            value={traffic.referrers.length}
            subValue={traffic.referrers[0]?.referrer ? `Top: ${traffic.referrers[0].referrer}` : undefined}
          />
        </div>

        {/* Traffic charts (14 days) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
          <TrafficAreaChart data={traffic.views.views} title="Views (last 14 days)" />
          <TrafficAreaChart
            data={traffic.clones.clones}
            title="Clones (last 14 days)"
            color="#da3633"
            secondaryColor="#f0883e"
          />
        </div>

        {/* Commit activity (52 weeks) + Participation */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
          {commitActivity.length > 0 && (
            <CommitActivityChart data={commitActivity} />
          )}
          {participation && (
            <ParticipationChart data={participation} />
          )}
        </div>

        {/* Referrers */}
        <div className="mb-8">
          <ReferrersChart referrers={traffic.referrers} title="Traffic Sources" />
        </div>

        {/* Referrer table */}
        {traffic.referrers.length > 0 && (
          <div className="rounded-lg border border-[var(--color-github-border)] overflow-hidden">
            <div className="px-4 py-3 bg-[var(--color-github-darker)] border-b border-[var(--color-github-border)]">
              <h2 className="text-sm font-semibold">Referrer Details</h2>
            </div>
            {traffic.referrers.map((r) => (
              <div
                key={r.referrer}
                className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-github-border)] last:border-0 bg-[var(--color-github-dark)]"
              >
                <span className="text-sm">{r.referrer}</span>
                <div className="flex items-center gap-6 text-sm">
                  <span>
                    <span className="font-semibold">{formatNumber(r.count)}</span>
                    <span className="text-[var(--color-github-muted)] ml-1 text-xs">views</span>
                  </span>
                  <span>
                    <span className="font-semibold">{formatNumber(r.uniques)}</span>
                    <span className="text-[var(--color-github-muted)] ml-1 text-xs">unique</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
