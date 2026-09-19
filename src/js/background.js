// Background service worker - handles API calls (avoids CORS issues in content scripts)

// This is the only writer of auth state. Chrome runs one service worker for the
// extension, so the queue covers content scripts, popup and OAuth callback alike.
let authQueue = Promise.resolve();
let legacyCleanupStarted = false;

function storageCall(area, method, value) {
  return new Promise((resolve, reject) => {
    chrome.storage[area][method](value, result => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message || "Extension storage is unavailable"));
      else resolve(result);
    });
  });
}

function cleanupLegacyToken() {
  if (legacyCleanupStarted) return;
  legacyCleanupStarted = true;
  // Cleanup never holds the auth queue or makes a valid local token unusable.
  // Check first to avoid unnecessary sync writes after a worker restart.
  void storageCall("sync", "get", ["ghToken"])
    .then(synced => synced.ghToken ? storageCall("sync", "remove", ["ghToken"]) : undefined)
    .catch(() => {});
}

async function writeAuthState(token) {
  // A single local write commits both credential and session. The signed-out
  // marker prevents a failed legacy cleanup from resurrecting a synced token.
  await storageCall("local", "set", {
    ghToken: token,
    gpi_auth_session: crypto.randomUUID(),
  });
  cleanupLegacyToken();
  const values = await storageCall("local", "get", null);
  const keys = Object.keys(values).filter(key => key.startsWith("gpi_") && key !== "gpi_auth_session");
  if (keys.length) await storageCall("local", "remove", keys);
}

async function readAuthState() {
  const keys = ["ghToken", "gpi_auth_session"];
  const local = await storageCall("local", "get", keys);
  if (local.ghToken || local.gpi_auth_session) {
    cleanupLegacyToken();
    return local.ghToken || null;
  }
  const synced = await storageCall("sync", "get", ["ghToken"]);
  if (!synced.ghToken) return null;
  const current = await storageCall("local", "get", keys);
  if (current.ghToken || current.gpi_auth_session) {
    cleanupLegacyToken();
    return current.ghToken || null;
  }
  // Keep the queue locked through the final read and migration write. A popup
  // save/clear requested during either callback runs only after migration.
  await writeAuthState(synced.ghToken);
  return synced.ghToken;
}

async function authOperation(message) {
  if (message.action === "get") return readAuthState();
  if (message.action === "clear") return writeAuthState(null);
  if (message.action === "save") {
    if (typeof message.token !== "string" || !message.token.trim()) throw new Error("A token is required");
    return writeAuthState(message.token.trim());
  }
  throw new Error("Unknown authentication operation");
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GPI_AUTH") {
    const operation = authQueue.then(() => authOperation(message));
    // A failed storage call must not poison subsequent requests.
    authQueue = operation.catch(() => {});
    operation.then(
      token => sendResponse({ ok: true, token: token ?? null }),
      error => sendResponse({ ok: false, error: error.message || "Authentication storage is unavailable" }),
    );
    return true;
  }

  if (message.type === "GPI_GRAPHQL") {
    fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${message.token}`
      },
      body: JSON.stringify({ query: message.query, variables: message.variables })
    })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.errors) {
          console.error("[GPI] GraphQL errors:", JSON.stringify(data.errors, null, 2));
          // Partial GraphQL data must never be mistaken for complete statistics.
          sendResponse({ errors: [{ message: "GitHub returned incomplete data" }] });
        } else {
          sendResponse(data?.data || null);
        }
      })
      .catch(err => {
        console.error("[GPI] Fetch error:", err);
        sendResponse(null);
      });
    return true;
  }

  if (message.type === "GPI_FETCH_USER") {
    fetch("https://api.github.com/user", {
      headers: { "Authorization": `Bearer ${message.token}` }
    })
      .then(res => res.ok ? res.json() : null)
      .then(data => sendResponse(data))
      .catch(() => sendResponse(null));
    return true;
  }
});
