// Dashboard rendering - injects insights panel into GitHub profile sidebar

import { formatNumber } from "./utils.js";
import {
  renderLanguageBar, renderLanguageLegend,
  computeStreaks, renderMiniHeatmap,
  renderContributionDonut, renderWeekdayChart,
  computePersonality, computeVelocity, computeAvgPerDay,
  computeWeekendPct, computePRMergeRate, computeIssueCloseRate,
  renderRepoTimeline
} from "./charts.js";
import { ACHIEVEMENTS, badgeState, tierLabel } from "./achievements.js";

function el(tag, className, innerHTML) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (innerHTML) e.innerHTML = innerHTML;
  return e;
}

// [arrow, class] per velocity trend; any unrecognised trend renders as neutral.
const VELOCITY_DISPLAY = {
  up: ["&#9650;", "gpi-trend-up"],
  down: ["&#9660;", "gpi-trend-down"],
  neutral: ["&#8212;", "gpi-trend-neutral"],
};

function formatFollowerRatio(followers, following) {
  if (following > 0) return (followers / following).toFixed(1);
  return followers > 0 ? "\u221e" : "0";
}

function diffClass(diff) {
  if (diff > 0) return "gpi-diff-pos";
  if (diff < 0) return "gpi-diff-neg";
  return "";
}

function topReposSection(topRepos) {
  if (topRepos.length === 0) return null;
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
  return repoSection;
}

// Percentage label for a donut segment; anything above 0 but under 1 shows "<1".
function segmentPercent(value, total) {
  const rawPct = (value / total) * 100;
  return rawPct > 0 && rawPct < 1 ? "<1" : rawPct.toFixed(0);
}

function contributionSection(contribs) {
  const donutData = renderContributionDonut(
    contribs.totalCommitContributions,
    contribs.totalPullRequestContributions,
    contribs.totalPullRequestReviewContributions,
    contribs.totalIssueContributions
  );
  if (!donutData) return null;
  const contribSection = el("div", "gpi-section gpi-contrib-section");
  contribSection.appendChild(el("div", "gpi-section-title", "Contribution Breakdown"));
  const contribContent = el("div", "gpi-contrib-content");
  contribContent.appendChild(donutData.svg);

  const contribStats = el("div", "gpi-contrib-stats");
  for (const seg of donutData.segments) {
    if (seg.value === 0) continue;
    // Text node, not innerHTML: through innerHTML a "<1%" slice opened a tag
    // and dropped the rest of the line.
    const row = el("div", "gpi-contrib-row");
    const dot = el("span", "gpi-pr-dot");
    dot.style.background = seg.color;
    row.append(dot, document.createTextNode(
      `${seg.label}: ${formatNumber(seg.value)} (${segmentPercent(seg.value, donutData.total)}%)`
    ));
    contribStats.appendChild(row);
  }
  contribContent.appendChild(contribStats);
  contribSection.appendChild(contribContent);
  return contribSection;
}

function footerStatsSection(streaks, user, totalIssues) {
  const footerStats = [];
  if (streaks.busiestDay.contributionCount > 0) {
    const bDate = new Date(streaks.busiestDay.date).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
    footerStats.push(`Busiest day: <strong>${bDate}</strong> (${streaks.busiestDay.contributionCount.toLocaleString()})`);
  }
  if (user.starredRepositories?.totalCount > 0) {
    footerStats.push(`Starred repos: <strong>${formatNumber(user.starredRepositories.totalCount)}</strong>`);
  }
  if (totalIssues > 0) {
    footerStats.push(`Issues opened: <strong>${formatNumber(totalIssues)}</strong>`);
  }
  if (footerStats.length === 0) return null;
  return el("div", "gpi-section gpi-footer-stats", footerStats.join(" &middot; "));
}

function comparisonSection(viewerStats, comparisons) {
  const compareSection = el("div", "gpi-section gpi-compare-section");
  compareSection.appendChild(el("div", "gpi-section-title", `vs. You (${viewerStats.login})`));
  const compareGrid = el("div", "gpi-compare-grid");
  for (const c of comparisons) {
    const diff = c.theirs - c.yours;
    const arrow = diff > 0 ? "+" : "";
    compareGrid.appendChild(el("div", "gpi-compare-row",
      `<span class="gpi-compare-label">${c.label}</span>` +
      `<span class="gpi-compare-theirs">${formatNumber(c.theirs)}</span>` +
      `<span class="gpi-compare-diff ${diffClass(diff)}">${arrow}${formatNumber(diff)}</span>`
    ));
  }
  compareSection.appendChild(compareGrid);
  return compareSection;
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
  const openPRs = user.openPRs?.totalCount ?? 0;
  const closedPRs = user.closedPRs?.totalCount ?? 0;
  const prMergeRate = computePRMergeRate(mergedPRs, openPRs, closedPRs);

  // Issue stats
  const totalIssues = user.issues?.totalCount ?? 0;
  const closedIssues = user.closedIssues?.totalCount ?? 0;
  const openIssues = user.openIssues?.totalCount ?? 0;
  const issueCloseRate = computeIssueCloseRate(closedIssues, openIssues);

  // Fork ratio & forks received
  const totalRepos = user.repositories.nodes.length;
  const forkCount = user.repositories.nodes.filter(r => r.isFork).length;
  const originalCount = totalRepos - forkCount;
  const totalForksReceived = user.repositories.nodes.reduce((sum, r) => sum + (r.forkCount || 0), 0);

  // Community stats
  const reposContributedTo = user.repositoriesContributedTo?.totalCount ?? 0;
  const orgCount = user.organizations?.totalCount ?? 0;

  // Computed stats
  const personality = computePersonality(
    contribs.totalCommitContributions,
    contribs.totalPullRequestContributions,
    contribs.totalPullRequestReviewContributions,
    contribs.totalIssueContributions
  );
  const velocity = computeVelocity(calendar);
  const avgPerDay = computeAvgPerDay(calendar);
  const weekendPct = computeWeekendPct(calendar);
  const languageCount = Object.keys(langMap).length;
  const accountAge = new Date().getFullYear() - new Date(user.createdAt).getFullYear();
  const followerRatio = formatFollowerRatio(user.followers.totalCount, user.following?.totalCount);

  // Build panel
  const panel = el("div", "gpi-panel");
  panel.id = "gpi-panel";
  panel.dataset.profile = user.login.toLowerCase();
  panel.setAttribute("role", "region");
  panel.setAttribute("aria-label", `GitScope insights for ${user.login}`);
  const loaded = el("span", "gpi-sr-only");
  loaded.setAttribute("role", "status");
  loaded.textContent = `Insights loaded for ${user.login}`;
  panel.appendChild(loaded);

  // Header
  const joinYear = new Date(user.createdAt).getFullYear();
  panel.appendChild(el("div", "gpi-header",
    `<span class="gpi-title">GitScope</span>` +
    `<span class="gpi-badge">Member since ${joinYear}</span>`
  ));

  // Stats grid (3x3)
  const statsGrid = el("div", "gpi-stats-grid");
  const stats = [
    { label: "Stars", value: formatNumber(totalStars), raw: totalStars.toLocaleString() },
    { label: "Last 365 Days", value: formatNumber(calendar.totalContributions), raw: `${calendar.totalContributions.toLocaleString()} contributions across 365 UTC dates including today` },
    { label: "Streak", value: `${streaks.currentStreak}d`, raw: `${streaks.currentStreak} consecutive days` },
    { label: "Best Streak", value: `${streaks.longestStreak}d`, raw: `${streaks.longestStreak} consecutive days` },
    { label: "Merged PRs", value: formatNumber(mergedPRs), raw: mergedPRs.toLocaleString() },
    { label: "PR Rate", value: `${prMergeRate}%`, raw: `${mergedPRs} merged of ${mergedPRs + openPRs + closedPRs} total` },
    { label: "Repos", value: formatNumber(user.repositories.totalCount), raw: user.repositories.totalCount.toLocaleString() },
    { label: "Forked", value: formatNumber(totalForksReceived), raw: `${totalForksReceived.toLocaleString()} forks of your repos` },
    { label: "Issues Closed", value: `${issueCloseRate}%`, raw: `${closedIssues} closed of ${closedIssues + openIssues} total` },
  ];
  for (const stat of stats) {
    const card = el("div", "gpi-stat-card",
      `<div class="gpi-stat-value">${stat.value}</div>` +
      `<div class="gpi-stat-label">${stat.label}</div>`
    );
    card.title = `${stat.label}: ${stat.raw}`;
    card.setAttribute("tabindex", "0");
    card.setAttribute("aria-label", card.title);
    statsGrid.appendChild(card);
  }
  panel.appendChild(statsGrid);

  // Personality badge + quick insights row
  const insightsRow = el("div", "gpi-section gpi-insights-row");
  const [velocityArrow, velocityClass] = VELOCITY_DISPLAY[velocity.trend] ?? VELOCITY_DISPLAY.neutral;
  insightsRow.innerHTML =
    `<div class="gpi-personality">` +
    `<span class="gpi-personality-label">${personality.label}</span>` +
    `<span class="gpi-personality-desc">${personality.description}</span>` +
    `</div>` +
    `<div class="gpi-quick-stats">` +
    `<span class="gpi-quick-stat" title="Average contributions per active day over the last 365 days">${avgPerDay}/active day</span>` +
    `<span class="gpi-quick-stat ${velocityClass}" tabindex="0" aria-label="Velocity ${velocity.trend}: last 28 complete UTC days vs previous 28" title="Last 28 complete UTC days vs previous 28; today excluded">${velocityArrow} Velocity</span>` +
    `<span class="gpi-quick-stat" title="${originalCount} original, ${forkCount} forked">${originalCount}/${forkCount} own/fork</span>` +
    `<span class="gpi-quick-stat" title="${weekendPct}% of contributions on weekends">${weekendPct}% weekends</span>` +
    `<span class="gpi-quick-stat" title="Codes in ${languageCount} languages">${languageCount} langs</span>` +
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
  const repoSection = topReposSection(topRepos);
  if (repoSection) panel.appendChild(repoSection);

  // Activity heatmap
  const heatmapSection = el("div", "gpi-section");
  heatmapSection.appendChild(el("div", "gpi-section-title", "Recent Activity"));
  heatmapSection.appendChild(renderMiniHeatmap(calendar));
  panel.appendChild(heatmapSection);

  // Contribution breakdown donut
  const contribSection = contributionSection(contribs);
  if (contribSection) panel.appendChild(contribSection);

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

  // Community & impact section
  const communityItems = [];
  if (reposContributedTo > 0) communityItems.push(`Contributed to <strong>${reposContributedTo}</strong> external repos`);
  if (orgCount > 0) communityItems.push(`Member of <strong>${orgCount}</strong> orgs`);
  communityItems.push(
    `Follower ratio: <strong>${followerRatio}</strong> (${user.followers.totalCount}/${user.following?.totalCount ?? 0})`,
    `${accountAge} years on GitHub`,
  );

  const communitySection = el("div", "gpi-section gpi-community-section");
  communitySection.appendChild(el("div", "gpi-section-title", "Community & Impact"));
  const communityGrid = el("div", "gpi-community-grid");
  for (const item of communityItems) {
    communityGrid.appendChild(el("div", "gpi-community-item", item));
  }
  communitySection.appendChild(communityGrid);
  panel.appendChild(communitySection);

  // Busiest day + extra stats
  const footerSection = footerStatsSection(streaks, user, totalIssues);
  if (footerSection) panel.appendChild(footerSection);

  // Profile comparison (when viewing someone else's profile)
  if (viewerStats) {
    panel.appendChild(comparisonSection(viewerStats, [
      { label: "Last 365 Days", theirs: calendar.totalContributions, yours: viewerStats.totalContributions },
      { label: "Stars", theirs: totalStars, yours: viewerStats.totalStars },
      { label: "Repos", theirs: user.repositories.totalCount, yours: viewerStats.totalRepos },
      { label: "Merged PRs", theirs: mergedPRs, yours: viewerStats.mergedPRs },
      { label: "Forks Received", theirs: totalForksReceived, yours: viewerStats.totalForks ?? 0 },
      { label: "Followers", theirs: user.followers.totalCount, yours: viewerStats.followers ?? 0 },
    ]));
  }

  return panel;
}

export function getDashboardTarget() {
  const card = document.querySelector(".Layout-sidebar .h-card");
  if (card) return { parent: card.parentNode, before: card.nextSibling };
  const sidebar = document.querySelector(".Layout-sidebar");
  if (sidebar) return { parent: sidebar, before: null };
  const person = document.querySelector('[itemtype="http://schema.org/Person"]');
  return person?.parentNode ? { parent: person.parentNode, before: person.nextSibling } : null;
}

export function removeDashboard() {
  for (const container of document.querySelectorAll(".gpi-container")) container.remove();
}

export function injectDashboard(panel) {
  removeDashboard();
  const target = getDashboardTarget();
  if (!target) return false;
  const container = el("div", "gpi-container");
  container.appendChild(panel);
  target.parent.insertBefore(container, target.before);
  return true;
}

export function showTokenPrompt() {
  const prompt = el("div", "gpi-panel gpi-token-prompt");
  prompt.id = "gpi-panel";
  prompt.setAttribute("role", "status");
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

  return injectDashboard(prompt);
}

export function showErrorState(username) {
  const panel = el("div", "gpi-panel gpi-error");
  panel.id = "gpi-panel";
  panel.setAttribute("role", "alert");
  panel.innerHTML =
    `<div class="gpi-header"><span class="gpi-title">GitScope</span></div>` +
    `<div class="gpi-section gpi-error-section">` +
    `<p class="gpi-error-text">Could not load data for ${username}.</p>` +
    `<button class="gpi-retry-btn" id="gpi-retry">Retry</button>` +
    `</div>`;

  return injectDashboard(panel);
}

export function showLoadingSkeleton() {
  const skeleton = el("div", "gpi-panel gpi-skeleton");
  skeleton.id = "gpi-panel";
  skeleton.setAttribute("role", "status");
  skeleton.setAttribute("aria-label", "Loading GitScope insights");
  skeleton.innerHTML =
    `<div class="gpi-header"><span class="gpi-title">GitScope</span><span class="gpi-badge">Loading...</span></div>` +
    `<div class="gpi-stats-grid">` +
    new Array(6).fill('<div class="gpi-stat-card"><div class="gpi-skeleton-line gpi-skeleton-value"></div><div class="gpi-skeleton-line gpi-skeleton-label"></div></div>').join("") +
    `</div>` +
    `<div class="gpi-section"><div class="gpi-skeleton-line" style="width:100%;height:8px;border-radius:4px"></div></div>`;

  return injectDashboard(skeleton);
}

const SVG_NS = "http://www.w3.org/2000/svg";

let medallionId = 0;

function svgNode(tag, attributes) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, String(value));
  return node;
}

// Mixes a #rrggbb colour toward black (amount < 0) or white (amount > 0).
function shade(hex, amount) {
  const target = amount < 0 ? 0 : 255;
  const channels = [1, 3, 5].map(i => Number.parseInt(hex.slice(i, i + 2), 16));
  return `#${channels.map(c => Math.round(c + (target - c) * Math.abs(amount)).toString(16).padStart(2, "0")).join("")}`;
}

// A medallion in the style of GitHub's achievement art: a domed disc in the
// badge colour, the Octicon GitHub uses for that kind of work as the emblem, and
// a rim that turns bronze, silver and gold at x2, x3 and x4.
function badgeMedallion(definition, level) {
  const id = `gpi-medal-${++medallionId}`;
  const [rimLight, rimDark] = ACHIEVEMENTS.rims[String(level)] ?? [shade(definition.color, 0.35), shade(definition.color, -0.45)];
  const svg = svgNode("svg", { viewBox: "0 0 64 64", width: 34, height: 34, "aria-hidden": "true", class: "gpi-medallion" });
  const defs = svgNode("defs", {});
  const rim = svgNode("linearGradient", { id: `${id}-rim`, x1: 0, y1: 0, x2: 1, y2: 1 });
  rim.append(svgNode("stop", { offset: 0, "stop-color": rimLight }), svgNode("stop", { offset: 1, "stop-color": rimDark }));
  const disc = svgNode("radialGradient", { id: `${id}-disc`, cx: "38%", cy: "30%", r: "78%" });
  disc.append(
    svgNode("stop", { offset: 0, "stop-color": shade(definition.color, 0.55) }),
    svgNode("stop", { offset: 0.55, "stop-color": definition.color }),
    svgNode("stop", { offset: 1, "stop-color": shade(definition.color, -0.4) }),
  );
  defs.append(rim, disc);
  svg.append(
    defs,
    svgNode("circle", { cx: 32, cy: 33, r: 30, fill: "#000", opacity: 0.18 }),
    svgNode("circle", { cx: 32, cy: 32, r: 30, fill: `url(#${id}-rim)` }),
    svgNode("circle", { cx: 32, cy: 32, r: 24.5, fill: `url(#${id}-disc)` }),
    svgNode("circle", { cx: 32, cy: 32, r: 24.5, fill: "none", stroke: "#fff", "stroke-opacity": 0.35, "stroke-width": 1.2 }),
  );
  const emblem = (fill, opacity, dy) => {
    const group = svgNode("g", { transform: `translate(15.6 ${15.6 + dy}) scale(2.05)`, fill, opacity });
    for (const d of ACHIEVEMENTS.icons[definition.icon] ?? []) group.appendChild(svgNode("path", { d }));
    return group;
  };
  svg.append(emblem(shade(definition.color, -0.6), 0.35, 1.2), emblem("#fff", 1, 0));
  svg.appendChild(svgNode("path", { d: "M14 26a19 19 0 0 1 36 0a26 18 0 0 0-36 0z", fill: "#fff", opacity: 0.22 }));
  return svg;
}

function nextTierName(level) {
  return level === 0 ? "the badge" : `x${level + 1}`;
}

function badgeCountText(definition, state, earnedKnown) {
  const unit = definition.id === "long-service" ? " years" : "";
  if (!definition.metric) {
    if (!earnedKnown) return "Shown on GitHub only";
    return state.level > 0 ? "Earned" : "Not earned yet";
  }
  if (state.count === null) return "Unavailable right now";
  // Exact numbers: "149 of 1,024" reads clearly where "1.0k" does not.
  const count = `${state.atLeast ? "at least " : ""}${state.count.toLocaleString("en-US")}`;
  if (state.next === null) return `${count}${unit}, top tier`;
  return `${count} of ${state.next.toLocaleString("en-US")}${unit} for ${nextTierName(state.level)}`;
}

function badgePercent(definition, state) {
  if (state.next === null) return state.level > 0 ? 100 : 0;
  if (state.count === null) return 0;
  const previous = definition.thresholds[state.level - 1] ?? 0;
  const span = state.next - previous;
  return Math.max(0, Math.min(100, ((state.count - previous) / span) * 100));
}

function badgeRow(definition, state, earnedKnown) {
  const row = el("div", "gpi-badge-row");
  row.dataset.level = String(state.level);
  row.dataset.badge = definition.id;
  row.style.setProperty("--gpi-badge", definition.color);

  const ring = el("span", "gpi-badge-ring");
  if (state.image) {
    const image = document.createElement("img");
    image.src = state.image;
    image.alt = "";
    image.width = 32;
    image.height = 32;
    ring.appendChild(image);
  } else {
    ring.appendChild(badgeMedallion(definition, state.level));
  }

  const body = el("div", "gpi-badge-body");
  const head = el("div", "gpi-badge-head");
  const name = el("span", "gpi-badge-name");
  name.textContent = definition.name;
  head.appendChild(name);
  const tier = tierLabel(state.level);
  if (tier) {
    const chip = el("span", `gpi-tier gpi-tier-${state.level}`);
    chip.textContent = tier;
    head.appendChild(chip);
  }
  const rule = el("div", "gpi-badge-rule");
  rule.textContent = definition.rule;
  const count = el("div", "gpi-badge-count");
  count.textContent = badgeCountText(definition, state, earnedKnown);

  body.append(head, rule);
  if (definition.metric) {
    const bar = el("div", "gpi-badge-bar");
    const fill = el("span");
    fill.style.width = `${badgePercent(definition, state).toFixed(1)}%`;
    bar.appendChild(fill);
    bar.setAttribute("role", "img");
    bar.setAttribute("aria-label", count.textContent);
    body.appendChild(bar);
  }
  body.appendChild(count);
  row.append(ring, body);
  return row;
}

function badgeGroup(title, definitions, metrics, earned, official) {
  const group = el("div", "gpi-badge-group");
  const heading = el("div", "gpi-badge-group-title");
  heading.textContent = title;
  group.appendChild(heading);
  // Badges with no count to show only say earned or not, so they share one strip.
  const strip = el("div", "gpi-badge-strip");
  for (const definition of definitions) {
    const state = badgeState(definition, metrics, earned, official);
    if (definition.metric) group.appendChild(badgeRow(definition, state, Boolean(earned)));
    else strip.appendChild(badgeChip(definition, state, Boolean(earned)));
  }
  if (strip.children.length) group.appendChild(strip);
  return group;
}

function badgeChip(definition, state, earnedKnown) {
  const chip = el("span", "gpi-badge-chip");
  chip.dataset.level = String(state.level);
  chip.dataset.badge = definition.id;
  chip.style.setProperty("--gpi-badge", definition.color);
  const status = badgeCountText(definition, state, earnedKnown);
  const tier = tierLabel(state.level);
  chip.title = `${definition.name}${tier ? ` ${tier}` : ""}: ${definition.rule}. ${status}.`;
  chip.setAttribute("aria-label", chip.title);
  chip.setAttribute("role", "img");
  chip.tabIndex = 0;
  const ring = el("span", "gpi-badge-ring");
  if (state.image) {
    const image = document.createElement("img");
    image.src = state.image;
    image.alt = "";
    ring.appendChild(image);
  } else {
    ring.appendChild(badgeMedallion(definition, state.level));
  }
  chip.appendChild(ring);
  if (tier) {
    const label = el("span", `gpi-tier gpi-tier-${state.level}`);
    label.textContent = tier;
    chip.appendChild(label);
  }
  const name = el("span", "gpi-badge-chip-name");
  name.textContent = definition.name;
  chip.appendChild(name);
  return chip;
}

// state: "loading", "error" or "ready". earned is the Map read from the profile
// page, or null when the page lists no badges.
export function buildAchievementsSection(state, metrics = null, earned = null) {
  const section = el("div", "gpi-section gpi-achievements");
  section.id = "gpi-achievements";
  section.appendChild(el("div", "gpi-section-title", "Achievements"));
  if (state !== "ready") {
    const status = el("p", "gpi-badge-status");
    status.setAttribute("role", "status");
    status.textContent = state === "loading" ? "Counting achievements..." : "Could not load achievement counts. They refresh on the next visit.";
    section.appendChild(status);
    if (state === "loading") return section;
  }
  section.appendChild(badgeGroup("GitHub", ACHIEVEMENTS.official, metrics, earned, true));
  section.appendChild(badgeGroup("GitScope", ACHIEVEMENTS.gitscope, metrics, earned, false));
  return section;
}

export function showAchievements(panel, section) {
  panel.querySelector("#gpi-achievements")?.remove();
  panel.appendChild(section);
}
