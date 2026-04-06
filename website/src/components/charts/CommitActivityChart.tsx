import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format } from "date-fns";
import type { WeeklyCommitActivity } from "../../lib/types";

interface CommitActivityChartProps {
  data: WeeklyCommitActivity[];
  title?: string;
}

export function CommitActivityChart({
  data,
  title = "Commit Activity (last year)",
}: CommitActivityChartProps) {
  // Filter to non-empty weeks and format
  const formatted = data
    .filter((w) => w.week > 0)
    .map((w) => ({
      week: format(new Date(w.week * 1000), "MMM d"),
      commits: w.total,
    }));

  if (formatted.length === 0) {
    return (
      <div className="p-6 rounded-lg border border-[var(--color-github-border)] bg-[var(--color-github-dark)]">
        <h3 className="text-sm font-semibold mb-4">{title}</h3>
        <div className="text-center text-[var(--color-github-muted)] py-8 text-sm">
          No commit activity data available
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 rounded-lg border border-[var(--color-github-border)] bg-[var(--color-github-dark)]">
      <h3 className="text-sm font-semibold mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={formatted} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
          <XAxis
            dataKey="week"
            tick={{ fill: "#8b949e", fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: "#30363d" }}
            interval={Math.max(0, Math.floor(formatted.length / 8) - 1)}
          />
          <YAxis
            tick={{ fill: "#8b949e", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              background: "#161b22",
              border: "1px solid #30363d",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: "#e6edf3" }}
          />
          <Bar dataKey="commits" name="Commits" fill="#238636" radius={[2, 2, 0, 0]} maxBarSize={12} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
