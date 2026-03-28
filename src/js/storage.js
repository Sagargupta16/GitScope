// Chrome storage helpers

export function getSavedToken() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(["ghToken"], (result) => resolve(result.ghToken || null));
  });
}

export function saveToken(token) {
  return new Promise((resolve) => {
    chrome.storage.sync.set({ ghToken: token }, resolve);
  });
}

export function clearSavedToken() {
  return new Promise((resolve) => {
    chrome.storage.sync.remove(["ghToken"], resolve);
  });
}

// Cache API responses in session storage (survives page reloads within tab)
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function getCached(key) {
  return new Promise((resolve) => {
    chrome.storage.local.get([key], (result) => {
      const entry = result[key];
      if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
        resolve(entry.data);
      } else {
        resolve(null);
      }
    });
  });
}

export function setCache(key, data) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [key]: { data, timestamp: Date.now() } }, resolve);
  });
}
