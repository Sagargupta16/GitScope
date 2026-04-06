import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { Referrer } from "../../lib/types";

interface ReferrersChartProps {
  referrers: Referrer[];
  title?: string;
}

export function ReferrersChart({
  referrers,
  title = "Top Referrers",
}: ReferrersChartProps) {
  const top = referrers.slice(0, 10);

  if (top.length === 0) {
    return (
      <div className="p-6 rounded-lg border border-[var(--color-github-border)] bg-[var(--color-github-dark)]">
        <h3 className="text-sm font-semibold mb-4">{title}</h3>
        <div className="text-center text-[var(--color-github-muted)] py-8 text-sm">
          No referrer data available
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 rounded-lg border border-[var(--color-github-border)] bg-[var(--color-github-dark)]">
      <h3 className="text-sm font-semibold mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={Math.max(160, top.length * 36)}>
        <BarChart data={top} layout="vertical" margin={{ top: 0, right: 20, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#30363d" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fill: "#8b949e", fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "#30363d" }}
            allowDecimals={false}
          />
          <YAxis
            type="category"
            dataKey="referrer"
            tick={{ fill: "#8b949e", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={140}
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
          <Bar
            dataKey="count"
            name="Visits"
            fill="#388bfd"
            radius={[0, 4, 4, 0]}
            maxBarSize={24}
          />
          <Bar
            dataKey="uniques"
            name="Unique"
            fill="#238636"
            radius={[0, 4, 4, 0]}
            maxBarSize={24}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
