// Cloudflare Worker - GitHub OAuth token exchange for GitScope extension + website

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Extension login: redirect to GitHub OAuth
    if (url.pathname === "/login") {
      const githubUrl = `https://github.com/login/oauth/authorize?client_id=${env.CLIENT_ID}&redirect_uri=${env.REDIRECT_URI}&scope=read:user%20read:org`;
      return Response.redirect(githubUrl, 302);
    }

    // Website login: redirect to GitHub OAuth with state=web to flag web flow
    if (url.pathname === "/web/login") {
      const githubUrl = `https://github.com/login/oauth/authorize?client_id=${env.CLIENT_ID}&redirect_uri=${env.REDIRECT_URI}&scope=read:user%20read:org&state=web`;
      return Response.redirect(githubUrl, 302);
    }

    // Shared callback: handles both extension and web flows
    if (url.pathname === "/callback") {
      const code = url.searchParams.get("code");
      if (!code) {
        return new Response("Missing code parameter", { status: 400 });
      }

      const isWebFlow = url.searchParams.get("state") === "web";

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

      // Web flow: redirect back to website with token in hash
      if (isWebFlow) {
        const siteUrl = "https://sagargupta16.github.io/GitScope/leaderboard";
        if (tokenData.error) {
          return Response.redirect(`${siteUrl}#error=auth_failed`, 302);
        }
        return Response.redirect(`${siteUrl}#token=${tokenData.access_token}`, 302);
      }

      // Extension flow: render page with postMessage
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
  const safeToken = token ? JSON.stringify(token) : null;
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
  ${safeToken ? `<script>
    var t = ${safeToken};
    document.body.setAttribute("data-gpi-token", t);
    try {
      if (window.opener) {
        window.opener.postMessage({ type: "GPI_AUTH_TOKEN", token: t }, "*");
      }
    } catch(e) {}
    setTimeout(function() { window.close(); }, 2000);
  </script>` : ""}
</body>
</html>`;
}
