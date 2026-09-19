// Tokens stay on this device. Cache data is scoped to the authentication session.
const CACHE_TTL = 5 * 60 * 1000;

function storageCall(area, method, value) {
  return new Promise((resolve, reject) => {
    chrome.storage[area][method](value, result => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message || "Extension storage is unavailable"));
      else resolve(result);
    });
  });
}

function authRequest(action, token) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: "GPI_AUTH", action, token }, response => {
      const error = chrome.runtime.lastError;
      if (error || !response?.ok) {
        reject(new Error(error?.message || response?.error || "Authentication storage is unavailable"));
      } else {
        resolve(action === "get" ? response.token ?? null : undefined);
      }
    });
  });
}

// All contexts use the same service-worker queue. A client-side promise/lock
// cannot serialize migration against writes from the popup or OAuth callback.
export function getSavedToken() {
  return authRequest("get");
}

export function saveToken(token) {
  return authRequest("save", token);
}

export function clearSavedToken() {
  return authRequest("clear");
}

export async function getCacheContext(token) {
  const local = await storageCall("local", "get", ["ghToken", "gpi_auth_session"]);
  if (!token || local.ghToken !== token) throw new Error("Authentication changed. Please retry.");
  // Never persist a raw credential as a cache key.
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  const digest = Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, "0")).join("");
  return `${digest}_${local.gpi_auth_session || "legacy"}`;
}

export async function getCached(key) {
  try {
    const values = await storageCall("local", "get", [key]);
    const entry = values[key];
    const age = Date.now() - entry?.timestamp;
    if (entry && Number.isFinite(age) && age >= 0 && age < CACHE_TTL) return entry.data;
    if (entry) await storageCall("local", "remove", [key]);
  } catch {
    // Cache failures are misses; authentication storage failures still reject.
  }
  return null;
}

export async function setCache(key, data) {
  try {
    await storageCall("local", "set", { [key]: { data, timestamp: Date.now() } });
    return true;
  } catch {
    return false;
  }
}

export async function saveViewerStats(stats, token) {
  const context = await getCacheContext(token);
  return setCache(`gpi_v2_${context}_viewer_stats`, stats);
}

export async function getViewerStats(token) {
  const context = await getCacheContext(token);
  return getCached(`gpi_v2_${context}_viewer_stats`);
}
