import { AreaChart, Area, ResponsiveContainer } from "recharts";
import type { TrafficDay } from "../../lib/types";

interface SparklineProps {
  data: TrafficDay[];
  color?: string;
  height?: number;
  width?: number;
}

export function Sparkline({
  data,
  color = "#238636",
  height = 24,
  width = 80,
}: SparklineProps) {
  if (data.length < 2) return null;

  return (
    <div style={{ width, height }} className="inline-block">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`spark-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.4} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="count"
            stroke={color}
            fill={`url(#spark-${color.replace("#", "")})`}
            strokeWidth={1.5}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
