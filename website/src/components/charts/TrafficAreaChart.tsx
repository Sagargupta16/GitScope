import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format, parseISO } from "date-fns";
import type { TrafficDay } from "../../lib/types";

interface TrafficAreaChartProps {
  data: TrafficDay[];
  title: string;
  color?: string;
  secondaryColor?: string;
}

export function TrafficAreaChart({
  data,
  title,
  color = "#238636",
  secondaryColor = "#388bfd",
}: TrafficAreaChartProps) {
  if (data.length === 0) {
    return (
      <div className="p-6 rounded-lg border border-[var(--color-github-border)] bg-[var(--color-github-dark)]">
        <h3 className="text-sm font-semibold mb-4">{title}</h3>
        <div className="text-center text-[var(--color-github-muted)] py-8 text-sm">
          No data available
        </div>
      </div>
    );
  }

  const formatted = data.map((d) => ({
    ...d,
    label: format(parseISO(d.date), "MMM d"),
  }));

  return (
    <div className="p-6 rounded-lg border border-[var(--color-github-border)] bg-[var(--color-github-dark)]">
      <h3 className="text-sm font-semibold mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={formatted} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id={`grad-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
            <linearGradient id={`grad-${secondaryColor.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={secondaryColor} stopOpacity={0.3} />
              <stop offset="95%" stopColor={secondaryColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
          <XAxis
            dataKey="label"
            tick={{ fill: "#8b949e", fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "#30363d" }}
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
            dataKey="count"
            name="Total"
            stroke={color}
            fill={`url(#grad-${color.replace("#", "")})`}
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="uniques"
            name="Unique"
            stroke={secondaryColor}
            fill={`url(#grad-${secondaryColor.replace("#", "")})`}
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
