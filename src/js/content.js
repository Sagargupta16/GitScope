// Content script entry point - runs on every GitHub page

import { isProfilePage, getProfileUsername } from "./utils.js";
import { getSavedToken, saveViewerStats, getViewerStats } from "./storage.js";
import { fetchProfileInsights } from "./api.js";
import { buildInsightsPanel, injectDashboard, showTokenPrompt, showLoadingSkeleton, showErrorState } from "./dashboard.js";

async function init() {
  if (!isProfilePage()) return;
  if (document.getElementById("gpi-panel")) return;

  const username = getProfileUsername();
  if (!username) return;

  const token = await getSavedToken();
  if (!token) {
    showTokenPrompt();
    return;
  }

  showLoadingSkeleton();

  try {
    const data = await fetchProfileInsights(username, token);
    if (!data?.user) {
      showErrorState(username);
      document.getElementById("gpi-retry")?.addEventListener("click", () => {
        document.getElementById("gpi-panel")?.parentElement?.remove();
        init();
      });
      return;
    }

    document.getElementById("gpi-panel")?.parentElement?.remove();

    // Determine if viewing own profile or someone else's
    const viewerLogin = data.user.login;
    const isOwnProfile = viewerLogin.toLowerCase() === username.toLowerCase();

    if (isOwnProfile) {
      const calendar = data.user.contributionsCollection.contributionCalendar;
      await saveViewerStats({
        login: viewerLogin,
        totalContributions: calendar.totalContributions,
        totalStars: data.user.repositories.nodes.reduce((s, r) => s + r.stargazerCount, 0),
        totalRepos: data.user.repositories.totalCount,
        mergedPRs: data.user.pullRequests.totalCount,
      });
    }

    let viewerStats = null;
    if (!isOwnProfile) {
      viewerStats = await getViewerStats();
    }

    const panel = buildInsightsPanel(data, viewerStats);
    injectDashboard(panel);
  } catch (err) {
    console.error("[GPI] Error:", err);
    showErrorState(username);
    document.getElementById("gpi-retry")?.addEventListener("click", () => {
      document.getElementById("gpi-panel")?.parentElement?.remove();
      init();
    });
  }
}

// Initial load
init();

// Handle GitHub SPA navigation (turbo:load for GitHub's Turbo framework)
document.addEventListener("turbo:load", () => {
  setTimeout(init, 300);
});

// Fallback: watch for URL changes via popstate
window.addEventListener("popstate", () => setTimeout(init, 300));
