// Dashboard rendering - injects insights panel into GitHub profile sidebar

import { formatNumber } from "./utils.js";
import {
  renderLanguageBar, renderLanguageLegend,
  computeStreaks, renderMiniHeatmap,
  renderContributionDonut, renderWeekdayChart,
  computePersonality, computeVelocity, computeAvgPerDay,
  renderRepoTimeline
} from "./charts.js";

function el(tag, className, innerHTML) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (innerHTML) e.innerHTML = innerHTML;
  return e;
}

export function buildInsightsPanel(data, viewerStats = null) {
  const user = data.user;
  const contribs = user.contributionsCollection;
  const calendar = contribs.contributionCalendar;

  // Language breakdown (exclude archived/forked repos)
  const langMap = {};
  let totalLangRepos = 0;
  for (const repo of user.repositories.nodes) {
    if (repo.isArchived || repo.isFork || !repo.primaryLanguage) continue;
    const { name, color } = repo.primaryLanguage;
    langMap[name] ??= { name, color, count: 0 };
    langMap[name].count++;
    totalLangRepos++;
  }

  const languages = Object.values(langMap)
    .map(l => ({ ...l, percentage: (l.count / totalLangRepos) * 100 }))
    .sort((a, b) => b.count - a.count);

  // Stars
  const totalStars = user.repositories.nodes.reduce((sum, r) => sum + r.stargazerCount, 0);

  // Top repos (non-fork, non-archived, by stars)
  const topRepos = user.repositories.nodes
    .filter(r => !r.isArchived && !r.isFork)
    .slice(0, 5);

  // Streaks
  const streaks = computeStreaks(calendar);

  // PR stats
  const mergedPRs = user.pullRequests.totalCount;

  // Fork ratio
  const totalRepos = user.repositories.nodes.length;
  const forkCount = user.repositories.nodes.filter(r => r.isFork).length;
  const originalCount = totalRepos - forkCount;

  // New computed stats
  const personality = computePersonality(
    contribs.totalCommitContributions,
    contribs.totalPullRequestContributions,
    contribs.totalPullRequestReviewContributions,
    contribs.totalIssueContributions
  );
  const velocity = computeVelocity(calendar);
  const avgPerDay = computeAvgPerDay(calendar);

  // Build panel
  const panel = el("div", "gpi-panel");
  panel.id = "gpi-panel";

  // Header
  const joinYear = new Date(user.createdAt).getFullYear();
  panel.appendChild(el("div", "gpi-header",
    `<span class="gpi-title">GitScope</span>` +
    `<span class="gpi-badge">Member since ${joinYear}</span>`
  ));

  // Stats grid
  const statsGrid = el("div", "gpi-stats-grid");
  const stats = [
    { label: "Stars", value: formatNumber(totalStars), raw: totalStars.toLocaleString() },
    { label: "This Year", value: formatNumber(calendar.totalContributions), raw: calendar.totalContributions.toLocaleString() },
    { label: "Streak", value: `${streaks.currentStreak}d`, raw: `${streaks.currentStreak} consecutive days` },
    { label: "Best Streak", value: `${streaks.longestStreak}d`, raw: `${streaks.longestStreak} consecutive days` },
    { label: "Merged PRs", value: formatNumber(mergedPRs), raw: mergedPRs.toLocaleString() },
    { label: "Repos", value: formatNumber(user.repositories.totalCount), raw: user.repositories.totalCount.toLocaleString() },
  ];
  for (const stat of stats) {
    const card = el("div", "gpi-stat-card",
      `<div class="gpi-stat-value">${stat.value}</div>` +
      `<div class="gpi-stat-label">${stat.label}</div>`
    );
    card.title = `${stat.label}: ${stat.raw}`;
    statsGrid.appendChild(card);
  }
  panel.appendChild(statsGrid);

  // Personality badge + quick insights row
  const insightsRow = el("div", "gpi-section gpi-insights-row");
  const velocityArrow = velocity.trend === "up" ? "&#9650;" : velocity.trend === "down" ? "&#9660;" : "&#8212;";
  const velocityClass = velocity.trend === "up" ? "gpi-trend-up" : velocity.trend === "down" ? "gpi-trend-down" : "gpi-trend-neutral";
  insightsRow.innerHTML =
    `<div class="gpi-personality">` +
    `<span class="gpi-personality-label">${personality.label}</span>` +
    `<span class="gpi-personality-desc">${personality.description}</span>` +
    `</div>` +
    `<div class="gpi-quick-stats">` +
    `<span class="gpi-quick-stat" title="Average contributions per active day">${avgPerDay}/day</span>` +
    `<span class="gpi-quick-stat ${velocityClass}" title="Velocity: last 4 weeks vs previous 4 weeks">${velocityArrow} Velocity</span>` +
    `<span class="gpi-quick-stat" title="${originalCount} original, ${forkCount} forked">${originalCount}/${forkCount} own/fork</span>` +
    `</div>`;
  panel.appendChild(insightsRow);

  // Languages
  if (languages.length > 0) {
    const langSection = el("div", "gpi-section");
    langSection.appendChild(el("div", "gpi-section-title", "Languages"));
    langSection.appendChild(renderLanguageBar(languages));
    langSection.appendChild(renderLanguageLegend(languages));
    panel.appendChild(langSection);
  }

  // Top repositories
  if (topRepos.length > 0) {
    const repoSection = el("div", "gpi-section");
    repoSection.appendChild(el("div", "gpi-section-title", "Top Repositories"));
    const repoList = el("div", "gpi-repo-list");
    for (const repo of topRepos) {
      const lang = repo.primaryLanguage;
      repoList.appendChild(el("div", "gpi-repo-item",
        `<a href="${repo.url}" class="gpi-repo-name">${repo.name}</a>` +
        `<span class="gpi-repo-meta">` +
        (lang ? `<span class="gpi-lang-dot" style="background:${lang.color}"></span>${lang.name}` : "") +
        ` &middot; ${repo.stargazerCount} stars</span>`
      ));
    }
    repoSection.appendChild(repoList);
    panel.appendChild(repoSection);
  }

  // Activity heatmap
  const heatmapSection = el("div", "gpi-section");
  heatmapSection.appendChild(el("div", "gpi-section-title", "Recent Activity"));
  heatmapSection.appendChild(renderMiniHeatmap(calendar));
  panel.appendChild(heatmapSection);

  // Contribution breakdown donut
  const donutData = renderContributionDonut(
    contribs.totalCommitContributions,
    contribs.totalPullRequestContributions,
    contribs.totalPullRequestReviewContributions,
    contribs.totalIssueContributions
  );
  if (donutData) {
    const contribSection = el("div", "gpi-section gpi-contrib-section");
    contribSection.appendChild(el("div", "gpi-section-title", "Contribution Breakdown"));
    const contribContent = el("div", "gpi-contrib-content");
    contribContent.appendChild(donutData.svg);

    const contribStats = el("div", "gpi-contrib-stats");
    for (const seg of donutData.segments) {
      if (seg.value === 0) continue;
      const rawPct = (seg.value / donutData.total) * 100;
      const pct = rawPct > 0 && rawPct < 1 ? "<1" : rawPct.toFixed(0);
      contribStats.appendChild(el("div", "gpi-contrib-row",
        `<span class="gpi-pr-dot" style="background:${seg.color}"></span>` +
        `${seg.label}: ${formatNumber(seg.value)} (${pct}%)`
      ));
    }
    contribContent.appendChild(contribStats);
    contribSection.appendChild(contribContent);
    panel.appendChild(contribSection);
  }

  // Day of week chart
  const weekdaySection = el("div", "gpi-section");
  weekdaySection.appendChild(el("div", "gpi-section-title",
    `Activity by Day <span class="gpi-section-hint">Most active: ${streaks.mostActiveWeekday}</span>`
  ));
  weekdaySection.appendChild(renderWeekdayChart(streaks.dayOfWeekCounts, streaks.dayNames));
  panel.appendChild(weekdaySection);

  // Repo growth timeline
  const timeline = renderRepoTimeline(user.repositories.nodes.filter(r => !r.isFork && !r.isArchived));
  if (timeline) {
    const timelineSection = el("div", "gpi-section");
    timelineSection.appendChild(el("div", "gpi-section-title", "Repo Growth"));
    timelineSection.appendChild(timeline);
    panel.appendChild(timelineSection);
  }

  // Busiest day + extra stats
  const footerStats = [];
  if (streaks.busiestDay.contributionCount > 0) {
    const bDate = new Date(streaks.busiestDay.date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    footerStats.push(`Busiest day: <strong>${bDate}</strong> (${streaks.busiestDay.contributionCount.toLocaleString()})`);
  }
  if (user.starredRepositories?.totalCount > 0) {
    footerStats.push(`Starred repos: <strong>${formatNumber(user.starredRepositories.totalCount)}</strong>`);
  }

  if (footerStats.length > 0) {
    panel.appendChild(el("div", "gpi-section gpi-footer-stats", footerStats.join(" &middot; ")));
  }

  // Profile comparison (when viewing someone else's profile)
  if (viewerStats) {
    const compareSection = el("div", "gpi-section gpi-compare-section");
    compareSection.appendChild(el("div", "gpi-section-title", `vs. You (${viewerStats.login})`));
    const compareGrid = el("div", "gpi-compare-grid");

    const comparisons = [
      { label: "Contributions", theirs: calendar.totalContributions, yours: viewerStats.totalContributions },
      { label: "Stars", theirs: totalStars, yours: viewerStats.totalStars },
      { label: "Repos", theirs: user.repositories.totalCount, yours: viewerStats.totalRepos },
      { label: "Merged PRs", theirs: mergedPRs, yours: viewerStats.mergedPRs },
    ];

    for (const c of comparisons) {
      const diff = c.theirs - c.yours;
      const arrow = diff > 0 ? "+" : "";
      compareGrid.appendChild(el("div", "gpi-compare-row",
        `<span class="gpi-compare-label">${c.label}</span>` +
        `<span class="gpi-compare-theirs">${formatNumber(c.theirs)}</span>` +
        `<span class="gpi-compare-diff ${diff > 0 ? "gpi-diff-pos" : diff < 0 ? "gpi-diff-neg" : ""}">${arrow}${formatNumber(diff)}</span>`
      ));
    }
    compareSection.appendChild(compareGrid);
    panel.appendChild(compareSection);
  }

  return panel;
}

export function injectDashboard(panel) {
  const sidebar = document.querySelector(".Layout-sidebar .h-card") ||
    document.querySelector(".Layout-sidebar") ||
    document.querySelector('[itemtype="http://schema.org/Person"]');

  if (!sidebar) return;

  const container = el("div", "gpi-container");
  container.appendChild(panel);
  sidebar.parentNode.insertBefore(container, sidebar.nextSibling);
}

export function showTokenPrompt() {
  const sidebar = document.querySelector(".Layout-sidebar .h-card") ||
    document.querySelector(".Layout-sidebar");
  if (!sidebar) return;

  const prompt = el("div", "gpi-panel gpi-token-prompt");
  prompt.id = "gpi-panel";
  prompt.innerHTML =
    `<div class="gpi-header"><span class="gpi-title">GitScope</span></div>` +
    `<div class="gpi-section">` +
    `<p class="gpi-prompt-text">Sign in via the extension popup to see:</p>` +
    `<ul class="gpi-feature-list">` +
    `<li>Contribution streaks and heatmap</li>` +
    `<li>Language breakdown across repos</li>` +
    `<li>Top repositories by stars</li>` +
    `<li>PR stats and activity patterns</li>` +
    `</ul>` +
    `</div>`;

  const container = el("div", "gpi-container");
  container.appendChild(prompt);
  sidebar.parentNode.insertBefore(container, sidebar.nextSibling);
}

export function showErrorState(username) {
  const existing = document.getElementById("gpi-panel")?.parentElement;
  if (existing) existing.remove();

  const sidebar = document.querySelector(".Layout-sidebar .h-card") ||
    document.querySelector(".Layout-sidebar");
  if (!sidebar) return;

  const panel = el("div", "gpi-panel gpi-error");
  panel.id = "gpi-panel";
  panel.innerHTML =
    `<div class="gpi-header"><span class="gpi-title">GitScope</span></div>` +
    `<div class="gpi-section gpi-error-section">` +
    `<p class="gpi-error-text">Could not load data for ${username}.</p>` +
    `<button class="gpi-retry-btn" id="gpi-retry">Retry</button>` +
    `</div>`;

  const container = el("div", "gpi-container");
  container.appendChild(panel);
  sidebar.parentNode.insertBefore(container, sidebar.nextSibling);
}

export function showLoadingSkeleton() {
  const sidebar = document.querySelector(".Layout-sidebar .h-card") ||
    document.querySelector(".Layout-sidebar");
  if (!sidebar) return;

  const skeleton = el("div", "gpi-panel gpi-skeleton");
  skeleton.id = "gpi-panel";
  skeleton.innerHTML =
    `<div class="gpi-header"><span class="gpi-title">GitScope</span><span class="gpi-badge">Loading...</span></div>` +
    `<div class="gpi-stats-grid">` +
    Array(6).fill('<div class="gpi-stat-card"><div class="gpi-skeleton-line gpi-skeleton-value"></div><div class="gpi-skeleton-line gpi-skeleton-label"></div></div>').join("") +
    `</div>` +
    `<div class="gpi-section"><div class="gpi-skeleton-line" style="width:100%;height:8px;border-radius:4px"></div></div>`;

  const container = el("div", "gpi-container");
  container.appendChild(skeleton);
  sidebar.parentNode.insertBefore(container, sidebar.nextSibling);
}
