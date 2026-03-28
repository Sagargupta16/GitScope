// Utility functions

const RESERVED_PATHS = new Set([
  "login", "signup", "settings", "notifications", "explore",
  "marketplace", "pulls", "issues", "codespaces", "sponsors",
  "organizations", "orgs", "new", "features", "pricing",
  "enterprise", "team", "security", "customer-stories", "readme",
  "about", "collections", "topics", "trending", "search"
]);

export function isProfilePage() {
  const parts = window.location.pathname.split("/").filter(Boolean);
  return parts.length === 1 && !RESERVED_PATHS.has(parts[0]);
}

export function getProfileUsername() {
  return window.location.pathname.split("/").filter(Boolean)[0];
}

export function formatNumber(num) {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}k`;
  return num.toString();
}
