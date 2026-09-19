// GitHub OAuth exchange. State is signed, short-lived, and bound to this browser.
const COOKIE = "__Host-gitscope_oauth";
const MAX_AGE = 600;
const ROUTES = new Set(["compare", "leaderboard", "dashboard"]);
const encoder = new TextEncoder();

function randomState() {
  return [...crypto.getRandomValues(new Uint8Array(32))]
    .map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function signingKey(secret) {
  return crypto.subtle.importKey("raw", encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

function encode(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decode(value) {
  return Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/")), (char) => char.charCodeAt(0));
}

async function seal(payload, secret) {
  const data = encode(encoder.encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign("HMAC", await signingKey(secret), encoder.encode(data));
  return `${data}.${encode(new Uint8Array(signature))}`;
}

async function unseal(value, secret) {
  try {
    const [data, signature, extra] = value.split(".");
    if (!data || !signature || extra) return null;
    if (!await crypto.subtle.verify("HMAC", await signingKey(secret), decode(signature), encoder.encode(data))) return null;
    const payload = JSON.parse(new TextDecoder().decode(decode(data)));
    if (!Number.isFinite(payload.expires) || payload.expires < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function response(body, status = 200, extra = {}) {
  return new Response(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      ...extra,
    },
  });
}

function cookie(value, age = MAX_AGE) {
  return `${COOKIE}=${value}; Path=/; Max-Age=${age}; Secure; HttpOnly; SameSite=Lax`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method !== "GET") return response("Method not allowed", 405, { Allow: "GET" });
    if (url.pathname === "/health") {
      return response(JSON.stringify({ service: "gitscope-auth", protocol: "state-v1" }), 200, {
        "Content-Type": "application/json",
      });
    }
    if (!["/login", "/web/login", "/callback"].includes(url.pathname)) return response("Not found", 404);
    if (!env.CLIENT_ID || !env.CLIENT_SECRET || !env.REDIRECT_URI) return response("Authentication is unavailable.", 503);

    if (url.pathname === "/login" || url.pathname === "/web/login") {
      const web = url.pathname === "/web/login";
      const returnTo = url.searchParams.get("return_to") || "leaderboard";
      const clientState = url.searchParams.get("client_state") || "";
      if (!ROUTES.has(returnTo) || (clientState && !/^[a-f0-9]{64}$/.test(clientState))) {
        return response("Invalid login request.", 400);
      }
      const state = randomState();
      // Old website releases have no client_state and need their existing traffic scope.
      // New clients explicitly opt into traffic; both paths receive validated OAuth state.
      const traffic = web && (url.searchParams.get("traffic") === "1" || !clientState);
      const payload = { state, web, returnTo, clientState, expires: Date.now() + MAX_AGE * 1000 };
      const githubUrl = new URL("https://github.com/login/oauth/authorize");
      githubUrl.search = new URLSearchParams({
        client_id: env.CLIENT_ID,
        redirect_uri: env.REDIRECT_URI,
        scope: traffic ? "read:user read:org repo" : "read:user read:org",
        state,
      }).toString();
      return response(null, 302, {
        Location: githubUrl.toString(),
        "Set-Cookie": cookie(await seal(payload, env.CLIENT_SECRET)),
      });
    }

    const state = url.searchParams.get("state");
    const rawCookie = (request.headers.get("Cookie") || "").split(";")
      .map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
    const pending = rawCookie ? await unseal(rawCookie, env.CLIENT_SECRET) : null;
    const clearedCookie = { "Set-Cookie": cookie("", 0) };
    if (!state || !pending || pending.state !== state) {
      return response("This sign-in has expired or does not match this browser. Start sign-in again.", 400, clearedCookie);
    }

    const siteBase = (env.SITE_URL || "https://sagargupta16.github.io/GitScope").replace(/\/$/, "");
    function finishError() {
      if (pending.web) {
        const fragment = new URLSearchParams({ error: "auth_failed", state: pending.clientState });
        return response(null, 302, { ...clearedCookie, Location: `${siteBase}/${pending.returnTo}#${fragment}` });
      }
      return response("Authorization failed. Close this tab and start sign-in again.", 400, clearedCookie);
    }

    const code = url.searchParams.get("code");
    if (!code || url.searchParams.has("error")) return finishError();
    try {
      const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          client_id: env.CLIENT_ID,
          client_secret: env.CLIENT_SECRET,
          redirect_uri: env.REDIRECT_URI,
          code,
        }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!tokenResponse.ok) return finishError();
      const tokenData = await tokenResponse.json();
      if (tokenData.error || typeof tokenData.access_token !== "string" || !tokenData.access_token) return finishError();
      if (pending.web) {
        const fragment = new URLSearchParams({
          token: tokenData.access_token,
          state: pending.clientState,
          scope: tokenData.scope || "",
        });
        return response(null, 302, { ...clearedCookie, Location: `${siteBase}/${pending.returnTo}#${fragment}` });
      }
      const nonce = randomState();
      return response(renderPage(tokenData.access_token, nonce), 200, {
        ...clearedCookie,
        "Content-Type": "text/html; charset=utf-8",
        "Content-Security-Policy": `default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; base-uri 'none'; frame-ancestors 'none'`,
      });
    } catch {
      return finishError();
    }
  },
};

function renderPage(token, nonce) {
  const safeToken = JSON.stringify(token).replace(/</g, "\\u003c");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>GitScope - Authorization successful</title>
<style>body{font:16px system-ui;background:#0d1117;color:#e6edf3;display:grid;place-items:center;min-height:90vh}.card{max-width:28rem;padding:2rem;text-align:center}p{line-height:1.6}</style>
</head><body><main class="card"><h1>Signed in to GitScope</h1>
<p>Your extension will save your sign-in. You can close this tab once it confirms.</p>
<p id="status" role="status">Connecting to the extension...</p></main>
<script nonce="${nonce}">document.body.setAttribute("data-gpi-token",${safeToken});</script>
</body></html>`;
}
