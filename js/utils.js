// Utility functions for GitHub Profile Insights

function isProfilePage() {
  var path = window.location.pathname;
  var parts = path.split("/").filter(Boolean);
  // Profile page: github.com/<username> (exactly 1 path segment, no reserved paths)
  var reserved = [
    "login", "signup", "settings", "notifications", "explore",
    "marketplace", "pulls", "issues", "codespaces", "sponsors",
    "organizations", "orgs", "new", "features", "pricing",
    "enterprise", "team", "security", "customer-stories", "readme",
    "about", "collections", "topics", "trending", "search"
  ];
  return parts.length === 1 && !reserved.includes(parts[0]);
}

function getProfileUsername() {
  return window.location.pathname.split("/").filter(Boolean)[0];
}


function formatNumber(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "k";
  return num.toString();
}

function daysSince(dateStr) {
  var now = new Date();
  var then = new Date(dateStr);
  return Math.floor((now - then) / (1000 * 60 * 60 * 24));
}

function getContrastColor(hexColor) {
  var r = parseInt(hexColor.slice(1, 3), 16);
  var g = parseInt(hexColor.slice(3, 5), 16);
  var b = parseInt(hexColor.slice(5, 7), 16);
  var luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? "#24292f" : "#ffffff";
}
