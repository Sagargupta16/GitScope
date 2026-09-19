// Content script entry point - runs on every GitHub page

import { isProfilePage, getProfileUsername } from "./utils.js";
import { getSavedToken, saveViewerStats, getViewerStats } from "./storage.js";
import { fetchProfileInsights, fetchAuthenticatedViewer } from "./api.js";
import {
  buildInsightsPanel, injectDashboard, showTokenPrompt, showLoadingSkeleton,
  showErrorState, getDashboardTarget, removeDashboard,
} from "./dashboard.js";

let generation = 0;
let activeRoute = null;
let running = false;
let navigating = false;

function viewerStatsFor(user) {
  const repos = user.repositories.nodes;
  return {
    login: user.login,
    totalContributions: user.contributionsCollection.contributionCalendar.totalContributions,
    totalStars: repos.reduce((sum, repo) => sum + repo.stargazerCount, 0),
    totalRepos: user.repositories.totalCount,
    mergedPRs: user.pullRequests.totalCount,
    totalForks: repos.reduce((sum, repo) => sum + (repo.forkCount || 0), 0),
    followers: user.followers.totalCount,
    reposContributedTo: user.repositoriesContributedTo?.totalCount ?? 0,
  };
}

async function init(force = false) {
  if (navigating) return;
  const route = window.location.href;
  if (force || route !== activeRoute) {
    generation++;
    running = false;
    activeRoute = route;
    removeDashboard();
  }
  if (!isProfilePage() || !getDashboardTarget()) return;
  if (running || document.getElementById("gpi-panel")) return;

  const username = getProfileUsername();
  const request = ++generation;
  const isCurrent = () => request === generation && route === window.location.href && isProfilePage();
  running = true;
  try {
    const token = await getSavedToken();
    if (!isCurrent()) return;
    if (!token) {
      showTokenPrompt();
      return;
    }
    showLoadingSkeleton();
    const [data, viewer] = await Promise.all([
      fetchProfileInsights(username, token), fetchAuthenticatedViewer(token),
    ]);
    if (!isCurrent()) return;
    const isOwnProfile = viewer.login.toLowerCase() === data.user.login.toLowerCase();
    let viewerStats = null;
    if (isOwnProfile) {
      await saveViewerStats(viewerStatsFor(data.user), token);
    } else {
      viewerStats = await getViewerStats(token);
      if (!isCurrent()) return;
      if (!viewerStats || viewerStats.login.toLowerCase() !== viewer.login.toLowerCase()) {
        const ownData = await fetchProfileInsights(viewer.login, token);
        if (!isCurrent()) return;
        viewerStats = viewerStatsFor(ownData.user);
        await saveViewerStats(viewerStats, token);
      }
    }
    if (!isCurrent()) return;
    const panel = buildInsightsPanel(data, viewerStats);
    injectDashboard(panel);
  } catch (err) {
    if (!isCurrent()) return;
    console.error("[GPI] Error:", err);
    showErrorState(username);
    document.getElementById("gpi-retry")?.addEventListener("click", () => init(true));
  } finally {
    if (request === generation) running = false;
  }
}

// A duplicate content-script evaluation must not register a second controller.
if (!window.__gpiContentInitialized) {
  window.__gpiContentInitialized = true;
  init();
  const loaded = () => {
    navigating = false;
    init();
  };
  document.addEventListener("turbo:load", loaded);
  window.addEventListener("popstate", loaded);
  const invalidate = () => {
    navigating = true;
    generation++;
    running = false;
    activeRoute = null;
    removeDashboard();
  };
  document.addEventListener("turbo:before-cache", invalidate);
  document.addEventListener("turbo:before-visit", event => {
    // Later listeners can cancel the visit; inspect the event after dispatch.
    queueMicrotask(() => {
      if (!event.defaultPrevented) invalidate();
    });
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && (changes.ghToken || changes.gpi_auth_session)) init(true);
  });

  // GitHub can mount/replace its sidebar after navigation events fire. Watching
  // child changes also detects pushState navigation without patching page APIs.
  const observer = new MutationObserver(() => init());
  observer.observe(document.documentElement, { childList: true, subtree: true });
}
