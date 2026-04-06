import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { getStoredToken, getStoredLogin, getLoginUrl } from "../lib/auth";
import { fetchRepoDetail } from "../lib/dashboard";
import { formatNumber } from "../lib/analytics";
import type { RepoTraffic } from "../lib/types";
import { StatCard } from "../components/charts/StatCard";
import { TrafficAreaChart } from "../components/charts/TrafficAreaChart";
import { ReferrersChart } from "../components/charts/ReferrersChart";

export function RepoDetail() {
  const { name } = useParams<{ name: string }>();
  const token = getStoredToken();
  const login = getStoredLogin();
  const [data, setData] = useState<RepoTraffic | null>(null);
  const [repoInfo, setRepoInfo] = useState<{
    stargazers_count: number;
    forks_count: number;
    open_issues_count: number;
    description: string | null;
    html_url: string;
    language: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!token || !login || !name || loadedRef.current) return;
    loadedRef.current = true;

    async function load() {
      try {
        const [traffic, infoRes] = await Promise.all([
          fetchRepoDetail(login!, name!, token!),
          fetch(`https://api.github.com/repos/${login}/${name}`, {
            headers: { Authorization: `bearer ${token}` },
          }),
        ]);

        setData(traffic);

        if (infoRes.ok) {
          const info = await infoRes.json();
          setRepoInfo({
            stargazers_count: info.stargazers_count,
            forks_count: info.forks_count,
            open_issues_count: info.open_issues_count,
            description: info.description,
            html_url: info.html_url,
            language: info.language,
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load repo data");
      } finally {
        setLoading(false);
      }
    }

    load();
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

  if (error) {
    return (
      <section className="py-20 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <div className="text-red-400 mb-6 p-4 rounded-lg border border-red-900 bg-red-950/30">
            {error}
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

  if (!data) return null;

  return (
    <section className="py-8 px-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <Link
              to="/dashboard"
              className="text-xs text-[var(--color-github-muted)] hover:text-white no-underline transition-colors"
            >
              &larr; Back to Dashboard
            </Link>
            <h1 className="text-2xl font-bold mt-1">{name}</h1>
            {repoInfo?.description && (
              <p className="text-sm text-[var(--color-github-muted)] mt-1">{repoInfo.description}</p>
            )}
          </div>
          {repoInfo && (
            <a
              href={repoInfo.html_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[var(--color-github-muted)] hover:text-white no-underline transition-colors"
            >
              View on GitHub &rarr;
            </a>
          )}
        </div>

        {/* Stats */}
        {repoInfo && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard label="Stars" value={formatNumber(repoInfo.stargazers_count)} />
            <StatCard label="Forks" value={formatNumber(repoInfo.forks_count)} />
            <StatCard label="Open Issues" value={formatNumber(repoInfo.open_issues_count)} />
            {repoInfo.language && <StatCard label="Language" value={repoInfo.language} />}
          </div>
        )}

        {/* Traffic stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Total Views"
            value={formatNumber(data.views.count)}
            subValue={`${formatNumber(data.views.uniques)} unique`}
          />
          <StatCard
            label="Total Clones"
            value={formatNumber(data.clones.count)}
            subValue={`${formatNumber(data.clones.uniques)} unique`}
          />
          <StatCard
            label="Avg Views/Day"
            value={
              data.views.views.length > 0
                ? (data.views.count / data.views.views.length).toFixed(1)
                : "0"
            }
          />
          <StatCard
            label="Referrers"
            value={data.referrers.length}
            subValue={data.referrers[0]?.referrer ? `Top: ${data.referrers[0].referrer}` : undefined}
          />
        </div>

        {/* Charts */}
        <div className="space-y-4 mb-8">
          <TrafficAreaChart data={data.views.views} title="Views (last 14 days)" />
          <TrafficAreaChart
            data={data.clones.clones}
            title="Clones (last 14 days)"
            color="#da3633"
            secondaryColor="#f0883e"
          />
        </div>

        {/* Referrers */}
        <div className="mb-8">
          <ReferrersChart referrers={data.referrers} title="Traffic Sources" />
        </div>

        {/* Referrer table */}
        {data.referrers.length > 0 && (
          <div className="rounded-lg border border-[var(--color-github-border)] overflow-hidden">
            <div className="px-4 py-3 bg-[var(--color-github-darker)] border-b border-[var(--color-github-border)]">
              <h2 className="text-sm font-semibold">Referrer Details</h2>
            </div>
            {data.referrers.map((r) => (
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
