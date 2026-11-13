import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router";
import { retryAuth, useAuth } from "../lib/auth";
import { LoginLink } from "../components/LoginLink";
import { Medallion } from "../components/Medallion";
import { useRequestGuard } from "../components/uiLifecycle";
import {
  ACHIEVEMENTS, badgeState, fetchAchievements, isGitHubLogin, tierLabel,
  type AchievementDefinition, type AchievementResult, type BadgeState,
} from "../lib/achievements";

const TIER_CLASS: Record<number, string> = {
  2: "bg-[#f9bc9c] text-[#1f2328]",
  3: "bg-[#d9dee3] text-[#1f2328]",
  4: "bg-[#f4d33d] text-[#1f2328]",
};

function nextTierName(level: number): string {
  return level === 0 ? "the badge" : `x${level + 1}`;
}

function countText(definition: AchievementDefinition, state: BadgeState): string {
  const unit = definition.id === "long-service" ? " years" : "";
  if (state.count === null) return "Unavailable right now";
  const count = `${state.atLeast ? "at least " : ""}${state.count.toLocaleString("en-US")}`;
  if (state.next === null) return `${count}${unit}, top tier`;
  return `${count} of ${state.next.toLocaleString("en-US")}${unit} for ${nextTierName(state.level)}`;
}

function percent(definition: AchievementDefinition, state: BadgeState): number {
  if (state.next === null) return state.level > 0 ? 100 : 0;
  if (state.count === null) return 0;
  const previous = definition.thresholds[state.level - 1] ?? 0;
  return Math.max(0, Math.min(100, ((state.count - previous) / (state.next - previous)) * 100));
}

function BadgeCard({ definition, state, index, profileUrl }: Readonly<{
  definition: AchievementDefinition; state: BadgeState; index: number; profileUrl: string;
}>) {
  const tier = tierLabel(state.level);
  return (
    <li className="badge-card flex gap-4 p-4 rounded-xl border border-[var(--color-github-border)] bg-[var(--color-github-dark)]"
      style={{ animationDelay: `${index * 45}ms` }}>
      {/* Without a public count the earned state is unknown, not locked, so draw it in colour. */}
      <Medallion definition={definition} level={definition.metric ? state.level : 1} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-semibold text-white">{definition.name}</h3>
          {tier && <span className={`text-xs font-bold px-2 rounded-full ${TIER_CLASS[state.level]}`}>{tier}</span>}
          {state.level === 0 && definition.metric && <span className="text-xs text-[var(--color-github-muted)]">locked</span>}
        </div>
        <p className="text-sm text-[var(--color-github-muted)] mt-0.5">{definition.rule}</p>
        {definition.metric ? <>
          <div className="h-1.5 mt-3 rounded-full bg-[var(--color-github-border)] overflow-hidden" role="img" aria-label={countText(definition, state)}>
            <div className="badge-bar h-full rounded-full" style={{ width: `${percent(definition, state).toFixed(1)}%`, background: definition.color }} />
          </div>
          <p className="text-xs text-[var(--color-github-muted)] mt-1.5">{countText(definition, state)}</p>
        </> : <a href={profileUrl} target="_blank" rel="noopener noreferrer"
          className="inline-block text-xs text-[var(--color-brand-light)] hover:underline mt-2">See if it is earned on GitHub</a>}
      </div>
    </li>
  );
}

function BadgeGroup({ title, note, definitions, result }: Readonly<{
  title: string; note: string; definitions: AchievementDefinition[]; result: AchievementResult;
}>) {
  const profileUrl = `https://github.com/${encodeURIComponent(result.login)}?tab=achievements`;
  return (
    <section aria-labelledby={`badges-${title}`} className="mb-10">
      <h2 id={`badges-${title}`} className="text-xl font-bold mb-1">{title}</h2>
      <p className="text-sm text-[var(--color-github-muted)] mb-4">{note}</p>
      <ul className="grid gap-3 sm:grid-cols-2">
        {definitions.map((definition, index) => (
          <BadgeCard key={definition.id} definition={definition} state={badgeState(definition, result.metrics)}
            index={index} profileUrl={profileUrl} />
        ))}
      </ul>
    </section>
  );
}

export function Achievements() {
  const { token, login: viewer, loading: authLoading, error: authError } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get("user")?.trim() || viewer || "";
  const [input, setInput] = useState(requested);
  const [result, setResult] = useState<AchievementResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { start, cancel } = useRequestGuard(token, viewer);

  useEffect(() => { setInput(requested); }, [requested]);

  useEffect(() => {
    setResult(null);
    setError(null);
    if (authLoading || !token || !requested) { setLoading(false); return cancel; }
    if (!isGitHubLogin(requested)) { setError("That is not a valid GitHub username."); setLoading(false); return cancel; }
    const request = start();
    setLoading(true);
    fetchAchievements(requested, token, request.signal)
      .then((data) => { if (request.current()) setResult(data); })
      .catch((err) => { if (request.current()) setError(err instanceof Error ? err.message : "Could not load achievements."); })
      .finally(() => { if (request.current()) setLoading(false); });
    return cancel;
  }, [authLoading, token, requested, start, cancel]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const user = input.trim();
    if (user) setSearchParams({ user });
  }

  return (
    <section className="py-12 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-2">Achievements</h1>
        <p className="text-center text-[var(--color-github-muted)] mb-6">
          GitHub&apos;s badges with progress to the next tier, and GitScope badges for work other people accepted.
        </p>
        {!token && !authLoading && <p className="text-center mb-6">
          <LoginLink returnTo={`/achievements${requested ? `?user=${encodeURIComponent(requested)}` : ""}`}
            className="bg-[var(--color-brand)] hover:bg-[var(--color-brand-light)] text-white px-6 py-3 rounded-lg font-semibold no-underline transition-colors">
            Sign in with GitHub to count badges
          </LoginLink>
        </p>}
        {authError && <div className="text-center mb-4">
          <p role="alert" className="text-red-400 mb-2">{authError}</p>
          <button type="button" onClick={() => void retryAuth()} disabled={authLoading}
            className="text-sm text-[var(--color-brand-light)] underline disabled:opacity-50">Retry verification</button>
        </div>}
        <form onSubmit={submit} className="flex flex-col sm:flex-row gap-3 mb-8">
          <label htmlFor="achievements-user" className="sr-only">GitHub username</label>
          <input id="achievements-user" type="text" autoCapitalize="none" autoComplete="off" spellCheck={false}
            placeholder="GitHub username" value={input} onChange={(event) => setInput(event.target.value)}
            className="flex-1 bg-[var(--color-github-dark)] border border-[var(--color-github-border)] rounded-lg px-4 py-2.5 text-white placeholder:text-[var(--color-github-muted)] focus:border-[var(--color-brand)] transition-colors" />
          <button type="submit" disabled={authLoading || !token || !input.trim()}
            className="bg-[var(--color-brand)] hover:bg-[var(--color-brand-light)] disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-lg font-semibold transition-colors">
            Show badges
          </button>
        </form>
        <p role="status" aria-live="polite" className="text-center text-sm text-[var(--color-github-muted)] mb-4">
          {loading ? `Counting badges for ${requested}… this takes a few seconds.` : ""}
        </p>
        {error && <div role="alert" className="text-center text-red-400 mb-6 p-4 rounded-lg border border-red-900 bg-red-950/30">{error}</div>}
        {result && <>
          <BadgeGroup title="GitHub" definitions={ACHIEVEMENTS.official} result={result}
            note="Tiers come from public counts. GitHub shows the earned tier on the profile; the GitScope extension reads it from there." />
          <BadgeGroup title="GitScope" definitions={ACHIEVEMENTS.gitscope} result={result}
            note="Counted from public activity. Each one needs someone else to merge, review or use the work." />
          <p className="text-center text-xs text-[var(--color-github-muted)]">
            Badge emblems use GitHub Octicons ({ACHIEVEMENTS.iconsLicense}).
          </p>
        </>}
      </div>
    </section>
  );
}
