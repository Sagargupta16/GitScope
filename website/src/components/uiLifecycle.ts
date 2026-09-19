import { useCallback, useEffect, useRef } from "react";
import { getAuthSessionId, getStoredLogin, getStoredToken } from "../lib/auth";

/** A result belongs to the request AND the account/session which started it. */
export function useRequestGuard(token: string | null, login: string | null) {
  const session = getAuthSessionId();
  const active = useRef<AbortController | null>(null);
  const cancel = useCallback(() => {
    active.current?.abort();
    active.current = null;
  }, []);
  useEffect(() => cancel, [cancel, token, login, session]);
  const start = useCallback(() => {
    cancel();
    const controller = new AbortController();
    active.current = controller;
    return {
      signal: controller.signal,
      current: () =>
        active.current === controller &&
        !controller.signal.aborted &&
        getAuthSessionId() === session &&
        getStoredToken() === token &&
        getStoredLogin()?.toLowerCase() === login?.toLowerCase(),
    };
  }, [cancel, token, login, session]);
  return { start, cancel, session };
}

export function accountCacheKey(kind: string, login: string, session: string) {
  return `gitscope_${kind}:${login.toLowerCase()}:${session}`;
}

export function readAccountCache<T>(key: string, login: string, session: string, ttl: number): T | null {
  try {
    const cached = JSON.parse(localStorage.getItem(key) ?? "null");
    const age = Date.now() - cached?.timestamp;
    if (!cached || cached.login !== login.toLowerCase() || cached.session !== session ||
      getAuthSessionId() !== session || getStoredLogin()?.toLowerCase() !== login.toLowerCase() ||
      !Number.isFinite(age) || age < 0 || age > ttl) return null;
    return cached.data as T;
  } catch {
    return null;
  }
}

export function writeAccountCache<T>(key: string, login: string, session: string, data: T) {
  if (getAuthSessionId() !== session || getStoredLogin()?.toLowerCase() !== login.toLowerCase()) return;
  try {
    localStorage.setItem(key, JSON.stringify({ login: login.toLowerCase(), session, data, timestamp: Date.now() }));
  } catch {
    // Storage is optional; a successful request should still render.
  }
}
