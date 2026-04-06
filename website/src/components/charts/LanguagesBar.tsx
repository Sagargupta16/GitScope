import type { Language } from "../../lib/types";

interface LanguagesBarProps {
  languages: Language[];
  totalCount: number;
}

export function LanguagesBar({ languages, totalCount }: LanguagesBarProps) {
  if (languages.length === 0) return null;

  return (
    <div className="p-4 rounded-lg border border-[var(--color-github-border)] bg-[var(--color-github-dark)]">
      <div className="text-xs font-semibold text-[var(--color-github-muted)] uppercase tracking-wide mb-2">
        Languages ({totalCount})
      </div>
      <div className="flex h-2.5 rounded overflow-hidden mb-3">
        {languages.map((l) => (
          <div
            key={l.name}
            style={{ width: `${l.percentage}%`, backgroundColor: l.color }}
            title={`${l.name} ${l.percentage.toFixed(1)}%`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {languages.map((l) => (
          <span key={l.name} className="text-xs text-[var(--color-github-muted)] flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{ backgroundColor: l.color }} />
            {l.name}
            <span className="opacity-60">{l.percentage.toFixed(0)}%</span>
            <span className="opacity-40">({l.count})</span>
          </span>
        ))}
      </div>
    </div>
  );
}
