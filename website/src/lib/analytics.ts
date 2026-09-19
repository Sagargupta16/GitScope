// Ported from src/js/charts.js - pure computation, no DOM

import type { Personality, Velocity } from "./types";

export interface ContributionDay {
  contributionCount: number;
  date: string;
  weekday: number;
}

export interface Calendar {
  totalContributions: number;
  weeks: { contributionDays: ContributionDay[] }[];
}

const DAY_MS = 86_400_000;

function calendarDays(calendar: Calendar, now = new Date()): ContributionDay[] {
  const today = now.toISOString().slice(0, 10);
  const days = new Map<string, ContributionDay>();
  for (const day of calendar.weeks.flatMap((w) => w.contributionDays)) {
    const time = Date.parse(day.date);
    if (day.date > today || !/^\d{4}-\d{2}-\d{2}$/.test(day.date) || !Number.isFinite(time)
      || new Date(time).toISOString().slice(0, 10) !== day.date
      || !Number.isFinite(day.contributionCount) || day.contributionCount < 0) continue;
    const previous = days.get(day.date);
    if (!previous || day.contributionCount > previous.contributionCount) {
      days.set(day.date, { ...day, weekday: new Date(time).getUTCDay() });
    }
  }
  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function computeStreaks(calendar: Calendar, now = new Date()) {
  const days = calendarDays(calendar, now);
  const counts = new Map(days.map((day) => [Date.parse(day.date), day.contributionCount]));
  const today = Date.parse(now.toISOString().slice(0, 10));
  let currentStreak = 0;
  let cursor = (counts.get(today) ?? 0) > 0 ? today : today - DAY_MS;
  while ((counts.get(cursor) ?? 0) > 0) {
    currentStreak++;
    cursor -= DAY_MS;
  }

  let longestStreak = 0;
  let temp = 0;
  let previousDate = -Infinity;
  for (const day of days) {
    const date = Date.parse(day.date);
    if (date - previousDate !== DAY_MS) temp = 0;
    if (day.contributionCount > 0) {
      temp++;
      longestStreak = Math.max(longestStreak, temp);
    } else {
      temp = 0;
    }
    previousDate = date;
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

export function computeVelocity(calendar: Calendar, now = new Date()): Velocity {
  const counts = new Map(calendarDays(calendar, now).map((day) => [Date.parse(day.date), day.contributionCount]));
  const today = Date.parse(now.toISOString().slice(0, 10));
  let recentTotal = 0;
  let prevTotal = 0;
  for (let offset = 1; offset <= 56; offset++) {
    const count = counts.get(today - offset * DAY_MS);
    if (count === undefined) return { trend: "neutral", ratio: 1 };
    if (offset <= 28) recentTotal += count;
    else prevTotal += count;
  }

  if (prevTotal === 0) return { trend: recentTotal > 0 ? "up" : "neutral", ratio: 1 };

  const ratio = recentTotal / prevTotal;
  if (ratio >= 1.2) return { trend: "up", ratio };
  if (ratio <= 0.8) return { trend: "down", ratio };
  return { trend: "neutral", ratio };
}

export function computeAvgPerDay(calendar: Calendar): number {
  const days = calendarDays(calendar);
  const activeDays = days.filter((d) => d.contributionCount > 0).length;
  if (activeDays === 0) return 0;
  const total = days.reduce((s, d) => s + d.contributionCount, 0);
  return Math.round((total / activeDays) * 10) / 10;
}

export function computeWeekendPct(calendar: Calendar): number {
  const days = calendarDays(calendar);
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
