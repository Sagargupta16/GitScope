// Runs on the OAuth callback page (gpi-auth.sg85207.workers.dev/callback)
// Reads the token from the page and stores it in chrome.storage

const checkToken = setInterval(() => {
  const token = document.body.getAttribute("data-gpi-token");
  if (token) {
    clearInterval(checkToken);
    chrome.storage.sync.set({ ghToken: token }, () => {
      console.log("[GPI] Token saved from callback");
    });
  }
}, 100);

setTimeout(() => clearInterval(checkToken), 10_000);
