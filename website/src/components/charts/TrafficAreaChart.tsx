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
import { format, parseISO } from "date-fns";
import type { TrafficDay } from "../../lib/types";

interface TrafficAreaChartProps {
  data: TrafficDay[];
  title: string;
  color?: string;
  secondaryColor?: string;
  uniqueLabel?: string;
  unavailable?: boolean;
}

export function TrafficAreaChart({
  data,
  title,
  color = "#238636",
  secondaryColor = "#388bfd",
  uniqueLabel = "Unique",
  unavailable = false,
}: TrafficAreaChartProps) {
  const gradient = useId();
  if (data.length === 0 || unavailable) {
    return (
      <div className="min-w-0 p-4 sm:p-6 rounded-lg border border-[var(--color-github-border)] bg-[var(--color-github-dark)]">
        <h3 className="text-sm font-semibold mb-4">{title}</h3>
        <div className="text-center text-[var(--color-github-muted)] py-8 text-sm">
          {unavailable ? "Traffic unavailable for this repository" : "No traffic recorded in this period"}
        </div>
      </div>
    );
  }

  const formatted = data.map((d) => ({
    ...d,
    label: format(parseISO(d.date), "MMM d"),
  }));

  return (
    <div className="min-w-0 p-4 sm:p-6 rounded-lg border border-[var(--color-github-border)] bg-[var(--color-github-dark)]">
      <h3 className="text-sm font-semibold mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart accessibilityLayer data={formatted} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id={`${gradient}-total`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
            <linearGradient id={`${gradient}-unique`} x1="0" y1="0" x2="0" y2="1">
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
            fill={`url(#${gradient}-total)`}
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="uniques"
            name={uniqueLabel}
            stroke={secondaryColor}
            fill={`url(#${gradient}-unique)`}
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
      <ChartData title={title} columns={["Date", "Total", uniqueLabel]} rows={data.map((day) => [day.date, day.count, day.uniques])} />
    </div>
  );
}
