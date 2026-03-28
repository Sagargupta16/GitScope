// Popup script - manages OAuth authentication

import { getSavedToken, clearSavedToken } from "./storage.js";

const AUTH_URL = "https://gpi-auth.sg85207.workers.dev/login";

async function showSignedIn(token) {
  const response = await fetch("https://api.github.com/user", {
    headers: { "Authorization": `Bearer ${token}` }
  });

  if (!response.ok) {
    await clearSavedToken();
    document.getElementById("signInSection").style.display = "block";
    return;
  }

  const user = await response.json();
  document.getElementById("userAvatar").src = `${user.avatar_url}&s=80`;
  document.getElementById("userName").textContent = user.name || user.login;
  document.getElementById("userLogin").textContent = `@${user.login}`;

  document.getElementById("signInSection").style.display = "none";
  document.getElementById("signedInSection").style.display = "block";
}

document.addEventListener("DOMContentLoaded", async () => {
  const token = await getSavedToken();
  if (token) await showSignedIn(token);

  document.getElementById("signInBtn").addEventListener("click", () => {
    window.open(AUTH_URL, "gpi_auth", "width=600,height=700");
  });

  document.getElementById("signOutBtn").addEventListener("click", async () => {
    await clearSavedToken();
    document.getElementById("signedInSection").style.display = "none";
    document.getElementById("signInSection").style.display = "block";
  });
});
