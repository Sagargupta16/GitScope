// Pure CSS/SVG chart rendering - no external dependencies

export function renderLanguageBar(languages) {
  const bar = document.createElement("div");
  bar.className = "gpi-lang-bar";

  for (const lang of languages) {
    const segment = document.createElement("div");
    segment.className = "gpi-lang-segment";
    segment.style.width = `${lang.percentage}%`;
    segment.style.backgroundColor = lang.color || "#8b949e";
    segment.title = `${lang.name} ${lang.percentage.toFixed(1)}%`;
    bar.appendChild(segment);
  }
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

export function computeStreaks(calendar) {
  const days = calendar.weeks.flatMap(w => w.contributionDays);
  const today = new Date().toISOString().split("T")[0];

  // Current streak
  let currentStreak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].date === today && days[i].contributionCount === 0) continue;
    if (days[i].contributionCount > 0) currentStreak++;
    else break;
  }

  // Longest streak
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

  // Busiest day
  const busiestDay = days.reduce((max, d) =>
    d.contributionCount > max.contributionCount ? d : max,
    { contributionCount: 0, date: "" }
  );

  // Most active day of week (0=Sun, 6=Sat)
  const dayOfWeekCounts = [0, 0, 0, 0, 0, 0, 0];
  for (const day of days) {
    dayOfWeekCounts[day.weekday] += day.contributionCount;
  }
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const mostActiveWeekday = dayNames[dayOfWeekCounts.indexOf(Math.max(...dayOfWeekCounts))];

  return { currentStreak, longestStreak, busiestDay, mostActiveWeekday, dayOfWeekCounts, dayNames };
}

export function renderMiniHeatmap(calendar) {
  const container = document.createElement("div");
  container.className = "gpi-heatmap";

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

      col.appendChild(cell);
    }
    container.appendChild(col);
  }
  return container;
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

  const max = Math.max(...dayOfWeekCounts);

  for (let i = 0; i < 7; i++) {
    const bar = document.createElement("div");
    bar.className = "gpi-weekday-bar-wrap";

    const fill = document.createElement("div");
    fill.className = "gpi-weekday-bar";
    fill.style.height = max > 0 ? `${(dayOfWeekCounts[i] / max) * 100}%` : "0%";
    fill.title = `${dayNames[i]}: ${dayOfWeekCounts[i]} contributions`;

    const label = document.createElement("div");
    label.className = "gpi-weekday-label";
    label.textContent = dayNames[i];

    bar.appendChild(fill);
    bar.appendChild(label);
    container.appendChild(bar);
  }
  return container;
}
