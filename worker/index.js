// Cloudflare Worker - GitHub OAuth token exchange for Profile Insights extension

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Step 1: Redirect user to GitHub OAuth
    if (url.pathname === "/login") {
      const githubUrl = `https://github.com/login/oauth/authorize?client_id=${env.CLIENT_ID}&redirect_uri=${env.REDIRECT_URI}&scope=read:user`;
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
        return new Response(renderPage("Authorization failed", "Please close this tab and try again.", "error"), {
          headers: { "Content-Type": "text/html" }
        });
      }

      // Return the token to the extension via postMessage
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
  <title>Profile Insights - ${title}</title>
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
    // Send token back to the extension
    window.postMessage({ type: "GPI_AUTH_TOKEN", token: "${token}" }, "*");
  </script>` : ""}
</body>
</html>`;
}
