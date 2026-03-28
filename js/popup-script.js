// Popup script - manages OAuth authentication

document.addEventListener("DOMContentLoaded", async function () {
  var signInSection = document.getElementById("signInSection");
  var signedInSection = document.getElementById("signedInSection");

  // Check if already signed in
  var token = await getSavedToken();
  if (token) {
    await showSignedIn(token);
  }

  // Sign in button - opens GitHub OAuth in popup window
  document.getElementById("signInBtn").addEventListener("click", async function () {
    var token = await startOAuth();
    if (token) {
      await saveToken(token);
      await showSignedIn(token);
    }
  });

  // Sign out button
  document.getElementById("signOutBtn").addEventListener("click", async function () {
    await clearSavedToken();
    signedInSection.style.display = "none";
    signInSection.style.display = "block";
  });

  async function showSignedIn(token) {
    var response = await fetch("https://api.github.com/user", {
      headers: { "Authorization": "Bearer " + token }
    });

    if (!response.ok) {
      await clearSavedToken();
      signInSection.style.display = "block";
      return;
    }

    var user = await response.json();
    document.getElementById("userAvatar").src = user.avatar_url + "&s=80";
    document.getElementById("userName").textContent = user.name || user.login;
    document.getElementById("userLogin").textContent = "@" + user.login;

    signInSection.style.display = "none";
    signedInSection.style.display = "block";
  }
});
