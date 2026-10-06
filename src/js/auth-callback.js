// Runs on the OAuth callback page (gpi-auth.sg85207.workers.dev/callback)
// The Worker validates its browser-bound OAuth state before rendering a token.
import { saveToken } from "./storage.js";

let saving = false;
const checkToken = setInterval(async () => {
  const token = document.body?.dataset.gpiToken;
  if (token) {
    if (saving) return;
    saving = true;
    clearInterval(checkToken);
    const status = document.getElementById("status");
    try {
      await saveToken(token);
      delete document.body.dataset.gpiToken;
      if (status) status.textContent = "Sign-in saved. You can close this tab.";
    } catch {
      delete document.body.dataset.gpiToken;
      if (status) status.textContent = "Could not save sign-in. Please reopen the extension and try again.";
    }
  }
}, 100);

setTimeout(() => clearInterval(checkToken), 10_000);
