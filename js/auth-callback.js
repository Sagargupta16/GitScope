// Runs on the OAuth callback page (gpi-auth.sg85207.workers.dev/callback)
// Reads the token from the page and stores it in chrome.storage

(function () {
  // Wait for the page to set the token attribute
  var checkToken = setInterval(function () {
    var token = document.body.getAttribute("data-gpi-token");
    if (token) {
      clearInterval(checkToken);
      chrome.storage.sync.set({ ghToken: token }, function () {
        console.log("[GPI] Token saved from callback");
      });
    }
  }, 100);

  // Stop checking after 10 seconds
  setTimeout(function () {
    clearInterval(checkToken);
  }, 10000);
})();
