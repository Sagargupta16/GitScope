// Popup script - manages OAuth Device Flow authentication

document.addEventListener("DOMContentLoaded", async function () {
  var signInSection = document.getElementById("signInSection");
  var deviceFlowSection = document.getElementById("deviceFlowSection");
  var signedInSection = document.getElementById("signedInSection");

  // Check if already signed in
  var token = await getSavedToken();
  if (token) {
    await showSignedIn(token);
  }

  // Sign in button
  document.getElementById("signInBtn").addEventListener("click", async function () {
    signInSection.style.display = "none";
    deviceFlowSection.style.display = "block";

    // Request device code
    var deviceData = await requestDeviceCode();
    if (!deviceData || !deviceData.user_code) {
      signInSection.style.display = "block";
      deviceFlowSection.style.display = "none";
      return;
    }

    // Show code to user
    document.getElementById("userCode").textContent = deviceData.user_code;

    // Poll for token
    var token = await pollForToken(deviceData.device_code, deviceData.interval || 5);

    if (token) {
      await saveToken(token);
      deviceFlowSection.style.display = "none";
      await showSignedIn(token);
    } else {
      // Expired or failed
      deviceFlowSection.style.display = "none";
      signInSection.style.display = "block";
    }
  });

  // Sign out button
  document.getElementById("signOutBtn").addEventListener("click", async function () {
    await clearSavedToken();
    signedInSection.style.display = "none";
    signInSection.style.display = "block";
  });

  async function showSignedIn(token) {
    // Fetch user info
    var response = await fetch("https://api.github.com/user", {
      headers: { "Authorization": "Bearer " + token }
    });

    if (!response.ok) {
      // Token invalid - clear and show sign in
      await clearSavedToken();
      signInSection.style.display = "block";
      return;
    }

    var user = await response.json();
    document.getElementById("userAvatar").src = user.avatar_url + "&s=80";
    document.getElementById("userName").textContent = user.name || user.login;
    document.getElementById("userLogin").textContent = "@" + user.login;

    signInSection.style.display = "none";
    deviceFlowSection.style.display = "none";
    signedInSection.style.display = "block";
  }
});
