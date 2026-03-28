// Dashboard rendering - injects insights panel into GitHub profile sidebar

import { formatNumber } from "./utils.js";
import {
  renderLanguageBar, renderLanguageLegend,
  computeStreaks, renderMiniHeatmap,
  renderContributionDonut, renderWeekdayChart
} from "./charts.js";

function el(tag, className, innerHTML) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (innerHTML) e.innerHTML = innerHTML;
  return e;
}

export function buildInsightsPanel(data) {
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
  const openPRs = user.openPRs.totalCount;
  const closedPRs = user.closedPRs.totalCount;

  // Build panel
  const panel = el("div", "gpi-panel");
  panel.id = "gpi-panel";

  // Header
  panel.appendChild(el("div", "gpi-header",
    `<span class="gpi-title">GitScope</span>` +
    `<span class="gpi-badge">gitscope</span>`
  ));

  // Stats grid
  const statsGrid = el("div", "gpi-stats-grid");
  const stats = [
    { label: "Stars", value: formatNumber(totalStars) },
    { label: "This Year", value: formatNumber(calendar.totalContributions) },
    { label: "Streak", value: `${streaks.currentStreak}d` },
    { label: "Best Streak", value: `${streaks.longestStreak}d` },
    { label: "Merged PRs", value: formatNumber(mergedPRs) },
    { label: "Repos", value: formatNumber(user.repositories.totalCount) },
  ];
  for (const stat of stats) {
    statsGrid.appendChild(el("div", "gpi-stat-card",
      `<div class="gpi-stat-value">${stat.value}</div>` +
      `<div class="gpi-stat-label">${stat.label}</div>`
    ));
  }
  panel.appendChild(statsGrid);

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
      const pct = ((seg.value / donutData.total) * 100).toFixed(0);
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

  // Busiest day + extra stats
  const footerStats = [];
  if (streaks.busiestDay.contributionCount > 0) {
    const bDate = new Date(streaks.busiestDay.date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    footerStats.push(`Busiest day: <strong>${bDate}</strong> (${streaks.busiestDay.contributionCount})`);
  }
  if (user.starredRepositories?.totalCount > 0) {
    footerStats.push(`Starred repos: <strong>${formatNumber(user.starredRepositories.totalCount)}</strong>`);
  }

  if (footerStats.length > 0) {
    panel.appendChild(el("div", "gpi-section gpi-footer-stats", footerStats.join(" &middot; ")));
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
    `<p class="gpi-prompt-text">Sign in with GitHub via the extension popup to see contribution insights, streaks, and language stats.</p>` +
    `</div>`;

  const container = el("div", "gpi-container");
  container.appendChild(prompt);
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
