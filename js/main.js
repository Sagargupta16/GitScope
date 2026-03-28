// Entry point - runs on every GitHub page

(async function () {
  if (!isProfilePage()) return;

  // Prevent duplicate injection
  if (document.getElementById("gpi-panel")) return;

  var username = getProfileUsername();
  if (!username) return;

  var token = await getSavedToken();
  if (!token) {
    showTokenPrompt();
    return;
  }

  try {
    var data = await fetchProfileInsights(username, token);
    if (!data || !data.user) {
      console.error("[GPI] Failed to fetch profile data for", username);
      return;
    }

    var panel = buildInsightsPanel(data);
    injectDashboard(panel);
  } catch (err) {
    console.error("[GPI] Error:", err);
  }
})();
