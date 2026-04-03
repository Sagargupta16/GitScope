// Ported from src/js/charts.js - pure computation, no DOM

import type { Personality, Velocity } from "./types";

interface ContributionDay {
  contributionCount: number;
  date: string;
  weekday: number;
}

interface Calendar {
  totalContributions: number;
  weeks: { contributionDays: ContributionDay[] }[];
}

export function computeStreaks(calendar: Calendar) {
  const days = calendar.weeks.flatMap((w) => w.contributionDays);
  const today = new Date().toISOString().split("T")[0];

  let currentStreak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].date === today && days[i].contributionCount === 0) continue;
    if (days[i].contributionCount > 0) currentStreak++;
    else break;
  }

  let longestStreak = 0;
  let temp = 0;
  for (const day of days) {
    if (day.contributionCount > 0) {
      temp++;
      longestStreak = Math.max(longestStreak, temp);
    } else {
      temp = 0;
    }
  }

  return { currentStreak, longestStreak };
}

export function computePersonality(
  commits: number,
  prs: number,
  reviews: number,
  issues: number,
): Personality {
  const total = commits + prs + reviews + issues;
  if (total === 0) return { label: "New", description: "Just getting started" };

  const commitPct = commits / total;
  const prPct = prs / total;
  const reviewPct = reviews / total;

  if (reviewPct >= 0.3) return { label: "Reviewer", description: "Focuses on code quality" };
  if (prPct >= 0.25) return { label: "Collaborator", description: "Drives work through PRs" };
  if (commitPct >= 0.9) return { label: "Builder", description: "Ships code relentlessly" };
  if (commitPct >= 0.7 && prPct >= 0.1) return { label: "Maker", description: "Builds and ships features" };
  return { label: "All-Rounder", description: "Balanced across all areas" };
}

export function computeVelocity(calendar: Calendar): Velocity {
  const weeks = calendar.weeks;
  if (weeks.length < 8) return { trend: "neutral", ratio: 1 };

  const recent4 = weeks.slice(-4);
  const prev4 = weeks.slice(-8, -4);

  const recentTotal = recent4.flatMap((w) => w.contributionDays).reduce((s, d) => s + d.contributionCount, 0);
  const prevTotal = prev4.flatMap((w) => w.contributionDays).reduce((s, d) => s + d.contributionCount, 0);

  if (prevTotal === 0) return { trend: recentTotal > 0 ? "up" : "neutral", ratio: 1 };

  const ratio = recentTotal / prevTotal;
  if (ratio >= 1.2) return { trend: "up", ratio };
  if (ratio <= 0.8) return { trend: "down", ratio };
  return { trend: "neutral", ratio };
}

export function computeAvgPerDay(calendar: Calendar): number {
  const days = calendar.weeks.flatMap((w) => w.contributionDays);
  const activeDays = days.filter((d) => d.contributionCount > 0).length;
  if (activeDays === 0) return 0;
  const total = days.reduce((s, d) => s + d.contributionCount, 0);
  return Math.round((total / activeDays) * 10) / 10;
}

export function computeWeekendPct(calendar: Calendar): number {
  const days = calendar.weeks.flatMap((w) => w.contributionDays);
  const total = days.reduce((s, d) => s + d.contributionCount, 0);
  if (total === 0) return 0;
  const weekend = days
    .filter((d) => d.weekday === 0 || d.weekday === 6)
    .reduce((s, d) => s + d.contributionCount, 0);
  return Math.round((weekend / total) * 100);
}

export function computePRMergeRate(merged: number, open: number, closed: number): number {
  const total = merged + open + closed;
  if (total === 0) return 0;
  return Math.round((merged / total) * 100);
}

export function computeIssueCloseRate(closed: number, open: number): number {
  const total = closed + open;
  if (total === 0) return 0;
  return Math.round((closed / total) * 100);
}

export function formatNumber(num: number): string {
  if (Math.abs(num) >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (Math.abs(num) >= 1_000) return `${(num / 1_000).toFixed(1)}k`;
  return num.toString();
}
