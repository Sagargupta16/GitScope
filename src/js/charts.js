// Pure CSS/SVG chart rendering - no external dependencies
const DAY_MS = 86400000;

function calendarDays(calendar, now = new Date()) {
  const today = now.toISOString().slice(0, 10);
  const days = new Map();
  for (const day of calendar.weeks.flatMap(w => w.contributionDays)) {
    if (day.date > today || !/^\d{4}-\d{2}-\d{2}$/.test(day.date) || !Number.isFinite(Date.parse(day.date))) continue;
    const previous = days.get(day.date);
    if (!previous || day.contributionCount > previous.contributionCount) days.set(day.date, day);
  }
  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
}

// One tab stop per chart; arrow keys explore the data without a hundred tabs.
function keyboardChart(container, items) {
  if (!items.length) return;
  container.setAttribute("role", "group");
  let index = 0;
  for (const [i, item] of items.entries()) {
    item.setAttribute("tabindex", i === 0 ? "0" : "-1");
    item.setAttribute("role", "img");
    item.setAttribute("aria-label", item.title);
    item.addEventListener("focus", () => {
      items[index].setAttribute("tabindex", "-1");
      index = i;
      item.setAttribute("tabindex", "0");
      readout.textContent = item.title;
    });
    item.addEventListener("keydown", event => {
      const delta = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
      if (delta === undefined && event.key !== "Home" && event.key !== "End") return;
      event.preventDefault();
      const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 :
        Math.max(0, Math.min(items.length - 1, index + delta));
      items[next].focus();
    });
  }
  const readout = document.createElement("span");
  readout.className = "gpi-chart-readout";
  readout.textContent = items[0].title;
  container.appendChild(readout);
}

export function renderLanguageBar(languages) {
  const bar = document.createElement("div");
  bar.className = "gpi-lang-bar";
  bar.setAttribute("aria-label", "Repository languages. Use arrow keys to explore.");

  for (const lang of languages) {
    const segment = document.createElement("div");
    segment.className = "gpi-lang-segment";
    segment.style.width = `${lang.percentage}%`;
    segment.style.backgroundColor = lang.color || "#8b949e";
    segment.title = `${lang.name} ${lang.percentage.toFixed(1)}%`;
    bar.appendChild(segment);
  }
  keyboardChart(bar, [...bar.children]);
  return bar;
}

export function renderLanguageLegend(languages) {
  const legend = document.createElement("div");
  legend.className = "gpi-lang-legend";

  for (const lang of languages.slice(0, 8)) {
    const item = document.createElement("span");
    item.className = "gpi-lang-item";
    item.innerHTML =
      `<span class="gpi-lang-dot" style="background:${lang.color || "#8b949e"}"></span>` +
      `<span class="gpi-lang-name">${lang.name}</span>` +
      `<span class="gpi-lang-pct">${lang.percentage.toFixed(1)}%</span>`;
    legend.appendChild(item);
  }
  return legend;
}

export function computeStreaks(calendar, now = new Date()) {
  const days = calendarDays(calendar, now);
  const byDate = new Map(days.map(d => [d.date, d.contributionCount]));
  let cursor = Date.parse(`${now.toISOString().slice(0, 10)}T00:00:00Z`);
  const dateAt = time => new Date(time).toISOString().slice(0, 10);
  // Today can still be in progress; yesterday cannot be skipped.
  if (!(byDate.get(dateAt(cursor)) > 0)) cursor -= DAY_MS;
  let currentStreak = 0;
  while (byDate.get(dateAt(cursor)) > 0) {
    currentStreak++;
    cursor -= DAY_MS;
  }

  // Longest streak
  let longestStreak = 0;
  let temp = 0;
  let previous = null;
  for (const day of days) {
    const time = Date.parse(`${day.date}T00:00:00Z`);
    if (time - previous !== DAY_MS) temp = 0;
    if (day.contributionCount > 0) {
      temp++;
      longestStreak = Math.max(longestStreak, temp);
    } else {
      temp = 0;
    }
    previous = time;
  }

  // Busiest day
  const busiestDay = days.reduce((max, d) =>
    d.contributionCount > max.contributionCount ? d : max,
    { contributionCount: 0, date: "" }
  );

  // Most active day of week (0=Sun, 6=Sat)
  const dayOfWeekCounts = [0, 0, 0, 0, 0, 0, 0];
  for (const day of days) {
    dayOfWeekCounts[new Date(`${day.date}T00:00:00Z`).getUTCDay()] += day.contributionCount;
  }
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const mostActiveWeekday = Math.max(...dayOfWeekCounts) > 0
    ? dayNames[dayOfWeekCounts.indexOf(Math.max(...dayOfWeekCounts))] : "None yet";

  return { currentStreak, longestStreak, busiestDay, mostActiveWeekday, dayOfWeekCounts, dayNames };
}

export function renderMiniHeatmap(calendar) {
  const wrapper = document.createElement("div");

  const container = document.createElement("div");
  container.className = "gpi-heatmap";
  container.setAttribute("aria-label", "Recent contributions. Use arrow keys to explore dates.");
  const cells = [];

  const recentWeeks = calendar.weeks.slice(-20);

  for (const week of recentWeeks) {
    const col = document.createElement("div");
    col.className = "gpi-heatmap-col";

    for (const day of week.contributionDays) {
      const cell = document.createElement("div");
      cell.className = "gpi-heatmap-cell";
      cell.title = `${day.date}: ${day.contributionCount} contributions`;

      const count = day.contributionCount;
      const level = count === 0 ? 0 : count <= 3 ? 1 : count <= 6 ? 2 : count <= 9 ? 3 : 4;
      cell.setAttribute("data-level", level);
      cell.style.marginTop = col.children.length === 0 ? `${day.weekday * 12}px` : "0";

      col.appendChild(cell);
      cells.push(cell);
    }
    container.appendChild(col);
  }
  keyboardChart(container, cells);

  wrapper.appendChild(container);

  const legend = document.createElement("div");
  legend.className = "gpi-heatmap-legend";
  legend.innerHTML =
    `<span>Less</span>` +
    `<span class="gpi-heatmap-cell" data-level="0"></span>` +
    `<span class="gpi-heatmap-cell" data-level="1"></span>` +
    `<span class="gpi-heatmap-cell" data-level="2"></span>` +
    `<span class="gpi-heatmap-cell" data-level="3"></span>` +
    `<span class="gpi-heatmap-cell" data-level="4"></span>` +
    `<span>More</span>`;
  wrapper.appendChild(legend);

  return wrapper;
}

export function renderContributionDonut(commits, prs, reviews, issues) {
  const total = commits + prs + reviews + issues;
  if (total === 0) return null;

  const segments = [
    { value: commits, color: "#238636", label: "Commits" },
    { value: prs, color: "#8957e5", label: "PRs" },
    { value: reviews, color: "#0969da", label: "Reviews" },
    { value: issues, color: "#bf8700", label: "Issues" }
  ];

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 36 36");
  svg.setAttribute("class", "gpi-donut");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", segments.map(s => `${s.label}: ${s.value}`).join(", "));
  svg.setAttribute("tabindex", "0");

  let offset = 0;
  for (const seg of segments) {
    if (seg.value === 0) continue;
    const pct = (seg.value / total) * 100;
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", "18");
    circle.setAttribute("cy", "18");
    circle.setAttribute("r", "15.915");
    circle.setAttribute("fill", "none");
    circle.setAttribute("stroke", seg.color);
    circle.setAttribute("stroke-width", "3.5");
    circle.setAttribute("stroke-dasharray", `${pct} ${100 - pct}`);
    circle.setAttribute("stroke-dashoffset", `${-offset}`);
    svg.appendChild(circle);
    offset += pct;
  }

  return { svg, segments, total };
}

export function renderWeekdayChart(dayOfWeekCounts, dayNames) {
  const container = document.createElement("div");
  container.className = "gpi-weekday-chart";
  container.setAttribute("aria-label", "Contributions by weekday. Use arrow keys to explore.");
  const bars = [];

  const max = Math.max(...dayOfWeekCounts);
  const maxIndex = dayOfWeekCounts.indexOf(max);

  for (let i = 0; i < 7; i++) {
    const bar = document.createElement("div");
    bar.className = "gpi-weekday-bar-wrap";

    const fill = document.createElement("div");
    fill.className = "gpi-weekday-bar";
    if (i === maxIndex && max > 0) fill.classList.add("gpi-weekday-bar-active");
    fill.style.height = max > 0 ? `${(dayOfWeekCounts[i] / max) * 100}%` : "0%";
    fill.title = `${dayNames[i]}: ${dayOfWeekCounts[i]} contributions`;
    bar.title = fill.title;

    const label = document.createElement("div");
    label.className = "gpi-weekday-label";
    if (i === maxIndex && max > 0) label.classList.add("gpi-weekday-label-active");
    label.textContent = dayNames[i];

    bar.appendChild(fill);
    bar.appendChild(label);
    container.appendChild(bar);
    bars.push(bar);
  }
  keyboardChart(container, bars);
  return container;
}

export function computePersonality(commits, prs, reviews, issues) {
  const total = commits + prs + reviews + issues;
  if (total === 0) return { label: "New", emoji: "seedling", description: "Just getting started" };

  const commitPct = commits / total;
  const prPct = prs / total;
  const reviewPct = reviews / total;

  if (reviewPct >= 0.3) return { label: "Reviewer", emoji: "mag", description: "Focuses on code quality" };
  if (prPct >= 0.25) return { label: "Collaborator", emoji: "handshake", description: "Drives work through PRs" };
  if (commitPct >= 0.9) return { label: "Builder", emoji: "hammer", description: "Ships code relentlessly" };
  if (commitPct >= 0.7 && prPct >= 0.1) return { label: "Maker", emoji: "rocket", description: "Builds and ships features" };
  return { label: "All-Rounder", emoji: "star", description: "Balanced across all areas" };
}

export function computeVelocity(calendar, now = new Date()) {
  const today = Date.parse(`${now.toISOString().slice(0, 10)}T00:00:00Z`);
  const days = new Map(calendarDays(calendar, now).map(d => [d.date, d.contributionCount]));
  let recentTotal = 0;
  let prevTotal = 0;
  for (let offset = 1; offset <= 56; offset++) {
    const date = new Date(today - offset * DAY_MS).toISOString().slice(0, 10);
    // Missing history is unknown rather than zero.
    if (!days.has(date)) return { trend: "neutral", ratio: 1 };
    if (offset <= 28) recentTotal += days.get(date);
    else prevTotal += days.get(date);
  }

  if (prevTotal === 0) return { trend: recentTotal > 0 ? "up" : "neutral", ratio: 1 };

  const ratio = recentTotal / prevTotal;
  if (ratio >= 1.2) return { trend: "up", ratio };
  if (ratio <= 0.8) return { trend: "down", ratio };
  return { trend: "neutral", ratio };
}

export function computeAvgPerDay(calendar) {
  const days = calendarDays(calendar);
  const activeDays = days.filter(d => d.contributionCount > 0).length;
  if (activeDays === 0) return 0;
  const total = days.reduce((s, d) => s + d.contributionCount, 0);
  return Math.round(total / activeDays * 10) / 10;
}

export function computeWeekendPct(calendar) {
  const days = calendarDays(calendar);
  const total = days.reduce((s, d) => s + d.contributionCount, 0);
  if (total === 0) return 0;
  const weekend = days
    .filter(d => d.weekday === 0 || d.weekday === 6)
    .reduce((s, d) => s + d.contributionCount, 0);
  return Math.round((weekend / total) * 100);
}

export function computePRMergeRate(merged, open, closed) {
  const total = merged + open + closed;
  if (total === 0) return 0;
  return Math.round((merged / total) * 100);
}

export function computeIssueCloseRate(closed, open) {
  const total = closed + open;
  if (total === 0) return 0;
  return Math.round((closed / total) * 100);
}

export function renderRepoTimeline(repos) {
  const yearCounts = {};
  for (const repo of repos) {
    if (!repo.createdAt) continue;
    const year = new Date(repo.createdAt).getFullYear();
    yearCounts[year] = (yearCounts[year] || 0) + 1;
  }

  const years = Object.keys(yearCounts).sort((a, b) => a.localeCompare(b));
  if (years.length < 2) return null;

  const counts = years.map(y => yearCounts[y]);
  const max = Math.max(...counts);

  const container = document.createElement("div");
  container.className = "gpi-timeline";
  container.setAttribute("aria-label", "Repositories created per year. Use arrow keys to explore.");
  const columns = [];

  for (let i = 0; i < years.length; i++) {
    const col = document.createElement("div");
    col.className = "gpi-timeline-col";

    const bar = document.createElement("div");
    bar.className = "gpi-timeline-bar";
    bar.style.height = max > 0 ? `${(counts[i] / max) * 100}%` : "0%";
    bar.title = `${years[i]}: ${counts[i]} repos created`;
    col.title = bar.title;

    const label = document.createElement("div");
    label.className = "gpi-timeline-label";
    label.textContent = years[i].slice(-2);

    col.appendChild(bar);
    col.appendChild(label);
    container.appendChild(col);
    columns.push(col);
  }
  keyboardChart(container, columns);
  return container;
}
