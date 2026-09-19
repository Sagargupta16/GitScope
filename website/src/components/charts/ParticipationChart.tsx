import { useId } from "react";
import { ChartData } from "./ChartData";
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
  title = "Weekly Commits (last 52 weeks)",
}: ParticipationChartProps) {
  const gradient = useId();
  const formatted = data.all.map((total, i) => ({
    week: `W${i + 1}`,
    all: total,
    owner: data.owner[i] ?? 0,
    others: total - (data.owner[i] ?? 0),
  }));

  const hasData = formatted.length > 0;

  if (!hasData) {
    return (
      <div className="min-w-0 p-4 sm:p-6 rounded-lg border border-[var(--color-github-border)] bg-[var(--color-github-dark)]">
        <h3 className="text-sm font-semibold mb-4">{title}</h3>
        <div className="text-center text-[var(--color-github-muted)] py-8 text-sm">
          No participation data available
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0 p-4 sm:p-6 rounded-lg border border-[var(--color-github-border)] bg-[var(--color-github-dark)]">
      <h3 className="text-sm font-semibold mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart accessibilityLayer data={formatted} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id={`${gradient}-owner`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#238636" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#238636" stopOpacity={0} />
            </linearGradient>
            <linearGradient id={`${gradient}-others`} x1="0" y1="0" x2="0" y2="1">
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
            name="Repository owner"
            stroke="#238636"
            fill={`url(#${gradient}-owner)`}
            strokeWidth={2}
            stackId="1"
          />
          <Area
            type="monotone"
            dataKey="others"
            name="Others"
            stroke="#388bfd"
            fill={`url(#${gradient}-others)`}
            strokeWidth={2}
            stackId="1"
          />
        </AreaChart>
      </ResponsiveContainer>
      <p className="text-xs text-[var(--color-github-muted)] mt-2">Weeks run from oldest to newest. Owner refers to the repository owner.</p>
      <ChartData title={title} columns={["Week", "All commits", "Repository owner", "Others"]} rows={formatted.map((week) => [week.week, week.all, week.owner, week.others])} />
    </div>
  );
}
