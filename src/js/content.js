// Content script entry point - runs on every GitHub page

import { isProfilePage, getProfileUsername } from "./utils.js";
import { getSavedToken } from "./storage.js";
import { fetchProfileInsights } from "./api.js";
import { buildInsightsPanel, injectDashboard, showTokenPrompt, showLoadingSkeleton } from "./dashboard.js";

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

  // Show loading skeleton while fetching
  showLoadingSkeleton();

  try {
    const data = await fetchProfileInsights(username, token);
    if (!data?.user) {
      console.error("[GPI] Failed to fetch profile data for", username);
      return;
    }

    // Remove skeleton and inject real dashboard
    document.getElementById("gpi-panel")?.parentElement?.remove();
    const panel = buildInsightsPanel(data);
    injectDashboard(panel);
  } catch (err) {
    console.error("[GPI] Error:", err);
  }
}

// Initial load
init();

// Handle GitHub SPA navigation (turbo:load for GitHub's Turbo framework)
document.addEventListener("turbo:load", () => {
  // Small delay to let GitHub finish rendering
  setTimeout(init, 300);
});

// Fallback: watch for URL changes via popstate
window.addEventListener("popstate", () => setTimeout(init, 300));
