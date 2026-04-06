import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { DashboardRepo } from "../../lib/types";

interface TopReposBarChartProps {
  repos: DashboardRepo[];
  dataKey: "totalViews" | "stargazers_count" | "totalClones";
  title: string;
  color?: string;
  limit?: number;
}

export function TopReposBarChart({
  repos,
  dataKey,
  title,
  color = "#238636",
  limit = 10,
}: TopReposBarChartProps) {
  const sorted = [...repos]
    .sort((a, b) => b[dataKey] - a[dataKey])
    .slice(0, limit)
    .filter((r) => r[dataKey] > 0);

  if (sorted.length === 0) {
    return (
      <div className="p-6 rounded-lg border border-[var(--color-github-border)] bg-[var(--color-github-dark)]">
        <h3 className="text-sm font-semibold mb-4">{title}</h3>
        <div className="text-center text-[var(--color-github-muted)] py-8 text-sm">
          No data available
        </div>
      </div>
    );
  }

  const labelMap: Record<string, string> = {
    totalViews: "Views",
    stargazers_count: "Stars",
    totalClones: "Clones",
  };

  return (
    <div className="p-6 rounded-lg border border-[var(--color-github-border)] bg-[var(--color-github-dark)]">
      <h3 className="text-sm font-semibold mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={Math.max(200, sorted.length * 36)}>
        <BarChart data={sorted} layout="vertical" margin={{ top: 0, right: 20, bottom: 0, left: 0 }}>
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
            dataKey="name"
            tick={{ fill: "#8b949e", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={120}
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
            dataKey={dataKey}
            name={labelMap[dataKey] ?? dataKey}
            fill={color}
            radius={[0, 4, 4, 0]}
            maxBarSize={24}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
