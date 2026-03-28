// Popup script - manages token storage

document.addEventListener("DOMContentLoaded", function () {
  var tokenInput = document.getElementById("tokenInput");
  var saveBtn = document.getElementById("saveBtn");
  var status = document.getElementById("status");

  // Load existing token
  chrome.storage.sync.get(["ghToken"], function (result) {
    if (result.ghToken) {
      tokenInput.value = result.ghToken.substring(0, 8) + "...";
      tokenInput.setAttribute("data-has-token", "true");
    }
  });

  // Clear placeholder on focus
  tokenInput.addEventListener("focus", function () {
    if (tokenInput.getAttribute("data-has-token") === "true") {
      tokenInput.value = "";
      tokenInput.removeAttribute("data-has-token");
    }
  });

  // Save token
  saveBtn.addEventListener("click", function () {
    var token = tokenInput.value.trim();
    if (!token || token.includes("...")) {
      status.textContent = "Enter a valid token";
      status.className = "status error";
      return;
    }

    // Validate token with a test request
    fetch("https://api.github.com/user", {
      headers: { "Authorization": "Bearer " + token }
    }).then(function (response) {
      if (response.ok) {
        chrome.storage.sync.set({ ghToken: token }, function () {
          status.textContent = "Token saved. Reload any GitHub profile to see insights.";
          status.className = "status success";
          tokenInput.value = token.substring(0, 8) + "...";
          tokenInput.setAttribute("data-has-token", "true");
        });
      } else {
        status.textContent = "Invalid token. Check permissions and try again.";
        status.className = "status error";
      }
    }).catch(function () {
      status.textContent = "Network error. Try again.";
      status.className = "status error";
    });
  });
});
