// GitHub OAuth Device Flow authentication
// No backend needed - works entirely client-side

var GPI_CLIENT_ID = "Ov23lijiO0uq76vl8Rp6";
var GPI_SCOPE = "read:user";

// Step 1: Request device and user codes from GitHub
async function requestDeviceCode() {
  var response = await fetch("https://github.com/login/device/code", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json"
    },
    body: JSON.stringify({
      client_id: GPI_CLIENT_ID,
      scope: GPI_SCOPE
    })
  });
  if (!response.ok) return null;
  return await response.json();
}

// Step 2: Poll GitHub until user completes authorization
async function pollForToken(deviceCode, interval) {
  return new Promise(function (resolve) {
    var pollInterval = setInterval(async function () {
      var response = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          client_id: GPI_CLIENT_ID,
          device_code: deviceCode,
          grant_type: "urn:ietf:params:oauth:grant-type:device_code"
        })
      });

      var data = await response.json();

      if (data.access_token) {
        clearInterval(pollInterval);
        resolve(data.access_token);
      } else if (data.error === "expired_token") {
        clearInterval(pollInterval);
        resolve(null);
      }
      // "authorization_pending" and "slow_down" - keep polling
      if (data.error === "slow_down") {
        clearInterval(pollInterval);
        interval += 5;
        pollInterval = setInterval(arguments.callee, interval * 1000);
      }
    }, interval * 1000);
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
