// Pure CSS/SVG chart rendering - no external dependencies

function renderLanguageBar(languages) {
  // languages: [{name, color, percentage}]
  var bar = document.createElement("div");
  bar.className = "gpi-lang-bar";

  languages.forEach(function (lang) {
    var segment = document.createElement("div");
    segment.className = "gpi-lang-segment";
    segment.style.width = lang.percentage + "%";
    segment.style.backgroundColor = lang.color || "#8b949e";
    segment.title = lang.name + " " + lang.percentage.toFixed(1) + "%";
    bar.appendChild(segment);
  });

  return bar;
}

function renderLanguageLegend(languages) {
  var legend = document.createElement("div");
  legend.className = "gpi-lang-legend";

  languages.slice(0, 8).forEach(function (lang) {
    var item = document.createElement("span");
    item.className = "gpi-lang-item";
    item.innerHTML =
      '<span class="gpi-lang-dot" style="background:' + (lang.color || "#8b949e") + '"></span>' +
      '<span class="gpi-lang-name">' + lang.name + '</span>' +
      '<span class="gpi-lang-pct">' + lang.percentage.toFixed(1) + '%</span>';
    legend.appendChild(item);
  });

  return legend;
}

function renderStreakCard(calendar) {
  var days = [];
  calendar.weeks.forEach(function (week) {
    week.contributionDays.forEach(function (day) {
      days.push(day);
    });
  });

  // Current streak
  var currentStreak = 0;
  var today = new Date().toISOString().split("T")[0];
  for (var i = days.length - 1; i >= 0; i--) {
    // Allow today to have 0 contributions (day not over yet)
    if (days[i].date === today && days[i].contributionCount === 0) continue;
    if (days[i].contributionCount > 0) {
      currentStreak++;
    } else {
      break;
    }
  }

  // Longest streak
  var longestStreak = 0;
  var tempStreak = 0;
  days.forEach(function (day) {
    if (day.contributionCount > 0) {
      tempStreak++;
      longestStreak = Math.max(longestStreak, tempStreak);
    } else {
      tempStreak = 0;
    }
  });

  // Busiest day
  var busiestDay = days.reduce(function (max, day) {
    return day.contributionCount > max.contributionCount ? day : max;
  }, { contributionCount: 0, date: "" });

  return { currentStreak: currentStreak, longestStreak: longestStreak, busiestDay: busiestDay };
}

function renderMiniHeatmap(calendar) {
  var container = document.createElement("div");
  container.className = "gpi-heatmap";

  // Last 16 weeks only for compact view
  var recentWeeks = calendar.weeks.slice(-16);

  recentWeeks.forEach(function (week) {
    var col = document.createElement("div");
    col.className = "gpi-heatmap-col";

    week.contributionDays.forEach(function (day) {
      var cell = document.createElement("div");
      cell.className = "gpi-heatmap-cell";
      cell.title = day.date + ": " + day.contributionCount + " contributions";

      if (day.contributionCount === 0) cell.setAttribute("data-level", "0");
      else if (day.contributionCount <= 3) cell.setAttribute("data-level", "1");
      else if (day.contributionCount <= 6) cell.setAttribute("data-level", "2");
      else if (day.contributionCount <= 9) cell.setAttribute("data-level", "3");
      else cell.setAttribute("data-level", "4");

      col.appendChild(cell);
    });

    container.appendChild(col);
  });

  return container;
}

function renderPRDonut(merged, open, closed) {
  var total = merged + open + closed;
  if (total === 0) return null;

  var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 36 36");
  svg.setAttribute("class", "gpi-donut");

  var segments = [
    { value: merged, color: "#238636", label: "Merged" },
    { value: open, color: "#3fb950", label: "Open" },
    { value: closed, color: "#f85149", label: "Closed" }
  ];

  var offset = 0;
  segments.forEach(function (seg) {
    if (seg.value === 0) return;
    var pct = (seg.value / total) * 100;
    var circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", "18");
    circle.setAttribute("cy", "18");
    circle.setAttribute("r", "15.915");
    circle.setAttribute("fill", "none");
    circle.setAttribute("stroke", seg.color);
    circle.setAttribute("stroke-width", "3");
    circle.setAttribute("stroke-dasharray", pct + " " + (100 - pct));
    circle.setAttribute("stroke-dashoffset", -offset + "");
    svg.appendChild(circle);
    offset += pct;
  });

  return svg;
}
