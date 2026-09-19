import { useSyncExternalStore } from "react";

const AUTH_KEY = "gitscope_auth_v2";
const PENDING_KEY = "gitscope_oauth_pending";
const SIGNOUT_KEY = "gitscope_signout";
const WORKER_URL = "https://gpi-auth.sg85207.workers.dev";
interface StoredAuth { token: string; login: string; scopes: string[]; sessionId: string }
interface AuthState { token: string | null; login: string | null; scopes: string[]; loading: boolean; error: string | null; retryable: boolean; signOut: () => void }
export interface LoginOptions { traffic?: boolean; returnTo?: "compare" | "leaderboard" | "dashboard" }
const listeners = new Set<() => void>();
let generation = 0;
let sessionId = "";
let initialized: Promise<void> | null = null;
let pendingVerification: string | null = null;
let snapshot: AuthState = { token: null, login: null, scopes: [], loading: true, error: null, retryable: false, signOut: () => clearAuth() };

function update(patch: Partial<AuthState>) {
  snapshot = { ...snapshot, ...patch };
  for (const listener of listeners) listener();
}
function stored(): StoredAuth | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(AUTH_KEY) || "null");
    return value && typeof value.token === "string" && value.token &&
      typeof value.login === "string" && value.login &&
      Array.isArray(value.scopes) && value.scopes.every((scope: unknown) => typeof scope === "string") ? value : null;
  } catch { return null; }
}
function clearCachedData() {
  for (const storage of [localStorage, sessionStorage]) {
    try {
      for (let i = storage.length - 1; i >= 0; i--) {
        const key = storage.key(i);
        if (key?.startsWith("gitscope_")) storage.removeItem(key);
      }
    } catch { /* Storage can be disabled; in-memory sign-out still takes effect. */ }
  }
}
export function getStoredToken(): string | null { return snapshot.token || stored()?.token || null; }
export function getStoredLogin(): string | null { return snapshot.login || stored()?.login || null; }
export function getAuthSessionId(): string { return sessionId; }
export function storeAuth(token: string, login: string, scopes: string[] = []) {
  const previous = stored();
  const sameSession = previous?.token === token && previous.login === login &&
    [...previous.scopes].sort().join(",") === [...scopes].sort().join(",");
  generation++;
  pendingVerification = null;
  if (!sameSession) clearCachedData();
  sessionId = sameSession && previous.sessionId ? previous.sessionId : crypto.randomUUID();
  try { sessionStorage.setItem(AUTH_KEY, JSON.stringify({ token, login, scopes, sessionId })); } catch { /* Current tab still works without persistence. */ }
  update({ token, login, scopes, loading: false, error: null, retryable: false });
}
export function clearAuth(broadcast = true) {
  generation++;
  pendingVerification = null;
  sessionId = crypto.randomUUID();
  clearCachedData();
  update({ token: null, login: null, scopes: [], loading: false, error: null, retryable: false });
  if (broadcast) {
    try { localStorage.setItem(SIGNOUT_KEY, sessionId); } catch { /* Optional cross-tab notification. */ }
  }
}
if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key === SIGNOUT_KEY && event.newValue) clearAuth(false);
  });
}
export function getLoginUrl(options: LoginOptions = {}): string {
  const url = new URL(`${WORKER_URL}/web/login`);
  url.searchParams.set("return_to", options.returnTo || "leaderboard");
  if (options.traffic) url.searchParams.set("traffic", "1");
  return url.toString();
}
export function beginLogin(options: LoginOptions = {}) {
  const state = [...crypto.getRandomValues(new Uint8Array(32))].map(n => n.toString(16).padStart(2, "0")).join("");
  try {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify({ state, expires: Date.now() + 600_000 }));
  } catch {
    update({ error: "Enable session storage in this browser to sign in securely.", retryable: false });
    return;
  }
  const url = new URL(getLoginUrl(options));
  url.searchParams.set("client_state", state);
  window.location.assign(url.toString());
}

class IdentityError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}
async function identity(token: string): Promise<{ login: string; scopes: string[] }> {
  const res = await fetch("https://api.github.com/user", {
    headers: { Authorization: `bearer ${token}`, Accept: "application/vnd.github+json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new IdentityError(res.status === 401 ? "Your sign-in has expired. Please sign in again." : "Could not verify your GitHub sign-in. Please try again.", res.status);
  const data = await res.json();
  if (typeof data.login !== "string") throw new Error("GitHub returned an invalid profile.");
  return { login: data.login, scopes: (res.headers.get("x-oauth-scopes") || "").split(/[ ,]+/).filter(Boolean) };
}
export async function fetchAuthenticatedUser(token: string): Promise<string> { return (await identity(token)).login; }

export function initializeAuth(): Promise<void> {
  if (initialized) return initialized;
  initialized = (async () => {
    const requestGeneration = generation;
    const previous = stored();
    const params = new URLSearchParams(window.location.hash.slice(1));
    const hasCallback = params.has("token") || params.has("error");
    let candidate: string | null = null;
    try {
      if (hasCallback) {
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
        const pending = JSON.parse(sessionStorage.getItem(PENDING_KEY) || "null");
        sessionStorage.removeItem(PENDING_KEY);
        if (!pending || !Number.isFinite(pending.expires) || pending.expires < Date.now() || !params.get("state") || params.get("state") !== pending.state) {
          throw new Error("This sign-in does not match this tab. Please start sign-in again.");
        }
        if (params.has("error")) throw new Error("GitHub sign-in was cancelled or failed. Please try again.");
        candidate = params.get("token");
        // Keep a validated callback available for retry without leaving it in the URL.
        pendingVerification = candidate;
      } else {
        candidate = pendingVerification || previous?.token || localStorage.getItem("gitscope_token");
      }
      if (!candidate) { update({ loading: false }); return; }
      const user = await identity(candidate);
      if (generation !== requestGeneration) return;
      try {
        localStorage.removeItem("gitscope_token");
        localStorage.removeItem("gitscope_login");
      } catch { /* A verified session can still be used if legacy storage is unavailable. */ }
      storeAuth(candidate, user.login, user.scopes);
    } catch (error) {
      if (generation !== requestGeneration) return;
      const invalidToken = error instanceof IdentityError && error.status === 401;
      if (invalidToken) pendingVerification = null;
      if (invalidToken && (!previous || candidate === previous.token)) {
        clearAuth(false);
      } else if (previous) {
        sessionId = previous.sessionId || crypto.randomUUID();
        update({ token: previous.token, login: previous.login, scopes: previous.scopes });
      }
      update({
        error: error instanceof Error ? error.message : "Sign-in failed. Please try again.",
        loading: false,
        retryable: Boolean(candidate) && !invalidToken,
      });
    }
  })();
  return initialized;
}

export function retryAuth(): Promise<void> {
  if (snapshot.loading && initialized) return initialized;
  initialized = null;
  update({ loading: true, error: null, retryable: false });
  return initializeAuth();
}

export function useAuth(): AuthState {
  return useSyncExternalStore((listener) => { listeners.add(listener); return () => listeners.delete(listener); }, () => snapshot, () => snapshot);
}
