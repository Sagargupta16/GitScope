// Dashboard rendering - injects insights panel into GitHub profile page

function buildInsightsPanel(data) {
  var user = data.user;
  var contribs = user.contributionsCollection;
  var calendar = contribs.contributionCalendar;

  // Language breakdown
  var langMap = {};
  var totalRepos = 0;
  user.repositories.nodes.forEach(function (repo) {
    if (repo.isArchived || repo.isFork) return;
    if (repo.primaryLanguage) {
      var name = repo.primaryLanguage.name;
      if (!langMap[name]) langMap[name] = { name: name, color: repo.primaryLanguage.color, count: 0 };
      langMap[name].count++;
      totalRepos++;
    }
  });

  var languages = Object.values(langMap)
    .map(function (l) { l.percentage = (l.count / totalRepos) * 100; return l; })
    .sort(function (a, b) { return b.count - a.count; });

  // Total stars
  var totalStars = user.repositories.nodes.reduce(function (sum, r) { return sum + r.stargazerCount; }, 0);

  // Streak data
  var streaks = renderStreakCard(calendar);

  // PR stats
  var mergedPRs = user.pullRequests.totalCount;
  var openPRs = user.openPRs.totalCount;
  var closedPRs = user.closedPRs.totalCount;

  // Build the panel
  var panel = document.createElement("div");
  panel.id = "gpi-panel";
  panel.className = "gpi-panel";

  // Header
  var header = document.createElement("div");
  header.className = "gpi-header";
  header.innerHTML = '<span class="gpi-title">Profile Insights</span>' +
    '<span class="gpi-badge">by GitHub Profile Insights</span>';
  panel.appendChild(header);

  // Stats grid
  var statsGrid = document.createElement("div");
  statsGrid.className = "gpi-stats-grid";

  var statsData = [
    { label: "Total Stars", value: formatNumber(totalStars), icon: "star" },
    { label: "Contributions (Year)", value: formatNumber(calendar.totalContributions), icon: "flame" },
    { label: "Current Streak", value: streaks.currentStreak + "d", icon: "zap" },
    { label: "Longest Streak", value: streaks.longestStreak + "d", icon: "trophy" },
    { label: "Merged PRs", value: formatNumber(mergedPRs), icon: "git-merge" },
    { label: "Repositories", value: formatNumber(user.repositories.totalCount), icon: "repo" }
  ];

  statsData.forEach(function (stat) {
    var card = document.createElement("div");
    card.className = "gpi-stat-card";
    card.innerHTML =
      '<div class="gpi-stat-value">' + stat.value + '</div>' +
      '<div class="gpi-stat-label">' + stat.label + '</div>';
    statsGrid.appendChild(card);
  });
  panel.appendChild(statsGrid);

  // Languages section
  var langSection = document.createElement("div");
  langSection.className = "gpi-section";
  langSection.innerHTML = '<div class="gpi-section-title">Languages</div>';
  if (languages.length > 0) {
    langSection.appendChild(renderLanguageBar(languages));
    langSection.appendChild(renderLanguageLegend(languages));
  }
  panel.appendChild(langSection);

  // Activity heatmap
  var heatmapSection = document.createElement("div");
  heatmapSection.className = "gpi-section";
  heatmapSection.innerHTML = '<div class="gpi-section-title">Recent Activity</div>';
  heatmapSection.appendChild(renderMiniHeatmap(calendar));
  panel.appendChild(heatmapSection);

  // PR breakdown
  if (mergedPRs + openPRs + closedPRs > 0) {
    var prSection = document.createElement("div");
    prSection.className = "gpi-section gpi-pr-section";
    prSection.innerHTML = '<div class="gpi-section-title">Pull Requests</div>';

    var prContent = document.createElement("div");
    prContent.className = "gpi-pr-content";

    var donut = renderPRDonut(mergedPRs, openPRs, closedPRs);
    if (donut) prContent.appendChild(donut);

    var prStats = document.createElement("div");
    prStats.className = "gpi-pr-stats";
    prStats.innerHTML =
      '<div class="gpi-pr-row"><span class="gpi-pr-dot" style="background:#238636"></span>Merged: ' + formatNumber(mergedPRs) + '</div>' +
      '<div class="gpi-pr-row"><span class="gpi-pr-dot" style="background:#3fb950"></span>Open: ' + formatNumber(openPRs) + '</div>' +
      '<div class="gpi-pr-row"><span class="gpi-pr-dot" style="background:#f85149"></span>Closed: ' + formatNumber(closedPRs) + '</div>';
    prContent.appendChild(prStats);

    prSection.appendChild(prContent);
    panel.appendChild(prSection);
  }

  // Busiest day
  if (streaks.busiestDay.contributionCount > 0) {
    var busiestSection = document.createElement("div");
    busiestSection.className = "gpi-section gpi-busiest";
    var bDate = new Date(streaks.busiestDay.date);
    busiestSection.innerHTML =
      '<span class="gpi-busiest-label">Busiest day this year:</span> ' +
      '<strong>' + bDate.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + '</strong>' +
      ' (' + streaks.busiestDay.contributionCount + ' contributions)';
    panel.appendChild(busiestSection);
  }

  return panel;
}

function injectDashboard(panel) {
  // Find the profile sidebar to inject after
  var sidebar = document.querySelector('.Layout-sidebar .h-card') ||
    document.querySelector('.Layout-sidebar') ||
    document.querySelector('[itemtype="http://schema.org/Person"]');

  if (sidebar) {
    // Insert after the user bio/card section
    var container = document.createElement("div");
    container.className = "gpi-container";
    container.appendChild(panel);
    sidebar.parentNode.insertBefore(container, sidebar.nextSibling);
  }
}

function showTokenPrompt() {
  var sidebar = document.querySelector('.Layout-sidebar .h-card') ||
    document.querySelector('.Layout-sidebar');
  if (!sidebar) return;

  var prompt = document.createElement("div");
  prompt.id = "gpi-panel";
  prompt.className = "gpi-panel gpi-token-prompt";
  prompt.innerHTML =
    '<div class="gpi-header">' +
    '<span class="gpi-title">Profile Insights</span>' +
    '</div>' +
    '<div class="gpi-section">' +
    '<p class="gpi-prompt-text">Add a GitHub token in the extension popup to see contribution insights, streaks, and language stats.</p>' +
    '<p class="gpi-prompt-hint">Click the extension icon to get started.</p>' +
    '</div>';

  var container = document.createElement("div");
  container.className = "gpi-container";
  container.appendChild(prompt);
  sidebar.parentNode.insertBefore(container, sidebar.nextSibling);
}
