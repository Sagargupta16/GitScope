// GitHub OAuth authentication via Cloudflare Worker

var GPI_AUTH_URL = "https://gpi-auth.sg85207.workers.dev/login";
var GPI_CALLBACK_URL = "https://gpi-auth.sg85207.workers.dev/callback";

// Open GitHub OAuth page in a popup window
function startOAuth() {
  return new Promise(function (resolve) {
    var popup = window.open(GPI_AUTH_URL, "gpi_auth", "width=600,height=700");

    // Listen for token from callback page
    window.addEventListener("message", function handler(event) {
      if (event.origin === "https://gpi-auth.sg85207.workers.dev" && event.data && event.data.type === "GPI_AUTH_TOKEN") {
        window.removeEventListener("message", handler);
        if (popup) popup.close();
        resolve(event.data.token);
      }
    });

    // Check if popup was closed without completing
    var checkClosed = setInterval(function () {
      if (popup && popup.closed) {
        clearInterval(checkClosed);
        resolve(null);
      }
    }, 1000);
  });
}

// Save token to chrome storage
function saveToken(token) {
  return new Promise(function (resolve) {
    chrome.storage.sync.set({ ghToken: token }, resolve);
  });
}

// Get saved token
function getSavedToken() {
  return new Promise(function (resolve) {
    chrome.storage.sync.get(["ghToken"], function (result) {
      resolve(result.ghToken || null);
    });
  });
}

// Clear token (logout)
function clearSavedToken() {
  return new Promise(function (resolve) {
    chrome.storage.sync.remove(["ghToken"], resolve);
  });
}
