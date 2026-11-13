import { useId } from "react";
import { ACHIEVEMENTS, type AchievementDefinition } from "../lib/achievements";

// Mixes a #rrggbb colour toward black (amount < 0) or white (amount > 0).
function shade(hex: string, amount: number): string {
  const target = amount < 0 ? 0 : 255;
  const channels = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
  return `#${channels.map((c) => Math.round(c + (target - c) * Math.abs(amount)).toString(16).padStart(2, "0")).join("")}`;
}

// Same drawing as the extension's badgeMedallion: a domed disc in the badge
// colour, the Octicon GitHub uses for that kind of work, and a rim that turns
// bronze, silver and gold at x2, x3 and x4 like GitHub's achievement art.
export function Medallion({ definition, level, size = 56 }: Readonly<{ definition: AchievementDefinition; level: number; size?: number }>) {
  const id = useId().replaceAll(":", "");
  const [rimLight, rimDark] = ACHIEVEMENTS.rims[String(level)] ?? [shade(definition.color, 0.35), shade(definition.color, -0.45)];
  const paths = ACHIEVEMENTS.icons[definition.icon] ?? [];
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true"
      className={`shrink-0 transition-transform duration-300 hover:scale-110 hover:-rotate-6 ${level === 0 ? "grayscale opacity-45" : ""}`}>
      <defs>
        <linearGradient id={`${id}-rim`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={rimLight} />
          <stop offset="1" stopColor={rimDark} />
        </linearGradient>
        <radialGradient id={`${id}-disc`} cx="38%" cy="30%" r="78%">
          <stop offset="0" stopColor={shade(definition.color, 0.55)} />
          <stop offset="0.55" stopColor={definition.color} />
          <stop offset="1" stopColor={shade(definition.color, -0.4)} />
        </radialGradient>
      </defs>
      <circle cx="32" cy="33" r="30" fill="#000" opacity="0.18" />
      <circle cx="32" cy="32" r="30" fill={`url(#${id}-rim)`} />
      <circle cx="32" cy="32" r="24.5" fill={`url(#${id}-disc)`} />
      <circle cx="32" cy="32" r="24.5" fill="none" stroke="#fff" strokeOpacity="0.35" strokeWidth="1.2" />
      <g transform="translate(15.6 16.8) scale(2.05)" fill={shade(definition.color, -0.6)} opacity="0.35">
        {paths.map((d) => <path key={d} d={d} />)}
      </g>
      <g transform="translate(15.6 15.6) scale(2.05)" fill="#fff">
        {paths.map((d) => <path key={d} d={d} />)}
      </g>
      <path d="M14 26a19 19 0 0 1 36 0a26 18 0 0 0-36 0z" fill="#fff" opacity="0.22" />
    </svg>
  );
}
