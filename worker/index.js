// Cloudflare Worker - GitHub OAuth token exchange for GitScope extension

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Step 1: Redirect user to GitHub OAuth
    if (url.pathname === "/login") {
      const githubUrl = `https://github.com/login/oauth/authorize?client_id=${env.CLIENT_ID}&redirect_uri=${env.REDIRECT_URI}&scope=read:user%20read:org%20repo`;
      return Response.redirect(githubUrl, 302);
    }

    // Step 2: GitHub redirects back with a code - exchange it for a token
    if (url.pathname === "/callback") {
      const code = url.searchParams.get("code");
      if (!code) {
        return new Response("Missing code parameter", { status: 400 });
      }

      const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          client_id: env.CLIENT_ID,
          client_secret: env.CLIENT_SECRET,
          code: code
        })
      });

      const tokenData = await tokenResponse.json();

      if (tokenData.error) {
        return new Response(renderPage("Authorization failed", "Please close this tab and try again.", "error", null), {
          headers: { "Content-Type": "text/html" }
        });
      }

      return new Response(renderPage("Authorization successful", "You can close this tab now.", "success", tokenData.access_token), {
        headers: { "Content-Type": "text/html" }
      });
    }

    return new Response("Not found", { status: 404 });
  }
};

function renderPage(title, message, status, token) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>GitScope - ${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f6f8fa; color: #24292f; }
    .card { text-align: center; padding: 40px; background: #fff; border-radius: 12px; border: 1px solid #d0d7de; max-width: 400px; }
    .icon { font-size: 48px; margin-bottom: 16px; }
    h1 { font-size: 20px; margin-bottom: 8px; }
    p { color: #656d76; font-size: 14px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${status === "success" ? "&#10003;" : "&#10007;"}</div>
    <h1>${title}</h1>
    <p>${message}</p>
  </div>
  ${token ? `<script>
    // Store token in localStorage so the extension content script can read it
    document.body.setAttribute("data-gpi-token", "${token}");
    // Also try opener (if popup was opened via window.open)
    try {
      if (window.opener) {
        window.opener.postMessage({ type: "GPI_AUTH_TOKEN", token: "${token}" }, "*");
      }
    } catch(e) {}
    // Auto-close after brief delay
    setTimeout(function() { window.close(); }, 2000);
  </script>` : ""}
</body>
</html>`;
}
