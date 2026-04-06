interface StatCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  trend?: "up" | "down" | "neutral";
}

export function StatCard({ label, value, subValue, trend }: StatCardProps) {
  return (
    <div className="p-4 rounded-lg border border-[var(--color-github-border)] bg-[var(--color-github-dark)]">
      <div className="text-xs text-[var(--color-github-muted)] uppercase tracking-wide mb-1">
        {label}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold">{value}</span>
        {trend && trend !== "neutral" && (
          <span
            className={`text-xs ${trend === "up" ? "text-green-400" : "text-red-400"}`}
          >
            {trend === "up" ? "\u25B2" : "\u25BC"}
          </span>
        )}
      </div>
      {subValue && (
        <div className="text-xs text-[var(--color-github-muted)] mt-1">{subValue}</div>
      )}
    </div>
  );
}
