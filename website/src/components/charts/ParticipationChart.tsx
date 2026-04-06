import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { ParticipationData } from "../../lib/types";

interface ParticipationChartProps {
  data: ParticipationData;
  title?: string;
}

export function ParticipationChart({
  data,
  title = "Weekly Commits (last year)",
}: ParticipationChartProps) {
  const formatted = data.all.map((total, i) => ({
    week: `W${i + 1}`,
    all: total,
    owner: data.owner[i] ?? 0,
    others: total - (data.owner[i] ?? 0),
  }));

  const hasData = formatted.some((w) => w.all > 0);

  if (!hasData) {
    return (
      <div className="p-6 rounded-lg border border-[var(--color-github-border)] bg-[var(--color-github-dark)]">
        <h3 className="text-sm font-semibold mb-4">{title}</h3>
        <div className="text-center text-[var(--color-github-muted)] py-8 text-sm">
          No participation data available
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 rounded-lg border border-[var(--color-github-border)] bg-[var(--color-github-dark)]">
      <h3 className="text-sm font-semibold mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={formatted} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id="grad-owner" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#238636" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#238636" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="grad-others" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#388bfd" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#388bfd" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
          <XAxis
            dataKey="week"
            tick={{ fill: "#8b949e", fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: "#30363d" }}
            interval={Math.floor(formatted.length / 6)}
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
          <Area
            type="monotone"
            dataKey="owner"
            name="You"
            stroke="#238636"
            fill="url(#grad-owner)"
            strokeWidth={2}
            stackId="1"
          />
          <Area
            type="monotone"
            dataKey="others"
            name="Others"
            stroke="#388bfd"
            fill="url(#grad-others)"
            strokeWidth={2}
            stackId="1"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
