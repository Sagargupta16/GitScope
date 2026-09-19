import type { ReactNode } from "react";
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router";
import { beginLogin, getAuthSessionId, useAuth } from "../lib/auth";

const RETURN_KEY = "gitscope_ui_return";
// main imports App before initializeAuth; capture the destination before auth
// clears old session caches when accepting the callback.
let pendingReturn: { path: string; timestamp: number; session: string } | null = null;
try { pendingReturn = JSON.parse(sessionStorage.getItem(RETURN_KEY) ?? "null"); } catch { /* Optional storage. */ }

function validReturnPath(path: unknown): path is string {
  return typeof path === "string" && /^\/(?:compare(?:\?[^#]*)?|leaderboard|dashboard(?:\/repo\/[^/?#]+)?)$/.test(path);
}

/** Keep query parameters/repository paths while the worker accepts page names only. */
export function LoginReturn() {
  const { token, loading, error, retryable } = useAuth();
  const session = getAuthSessionId();
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    if (loading) return;
    try {
      const pending = pendingReturn ?? JSON.parse(sessionStorage.getItem(RETURN_KEY) ?? "null");
      if (!pending) return;
      const age = Date.now() - pending.timestamp;
      if ((error && !retryable) || !validReturnPath(pending.path) || !Number.isFinite(age) || age < 0 || age > 10 * 60 * 1000) {
        sessionStorage.removeItem(RETURN_KEY);
        pendingReturn = null;
        return;
      }
      if (error && retryable) return;
      if (!token || pending.session === session) return;
      sessionStorage.removeItem(RETURN_KEY);
      pendingReturn = null;
      navigate(pending.path, { replace: true });
    } catch {
      // The main auth flow still works when optional return-path storage is unavailable.
    }
  }, [token, loading, error, retryable, session, navigate, location.pathname]);
  return null;
}

export function LoginLink({ traffic = false, returnTo, className, children }: {
  traffic?: boolean;
  returnTo: string;
  className?: string;
  children: ReactNode;
}) {
  const page = returnTo.startsWith("/dashboard") ? "dashboard" : returnTo.startsWith("/leaderboard") ? "leaderboard" : "compare";
  const options = { traffic, returnTo: page } as const;
  return (
    <button type="button" className={className}
      onClick={() => {
        try {
          if (validReturnPath(returnTo)) sessionStorage.setItem(RETURN_KEY, JSON.stringify({
            path: returnTo, timestamp: Date.now(), session: getAuthSessionId(),
          }));
        } catch {
          // Navigation can continue to the page without optional deep-link restoration.
        }
        beginLogin(options);
      }}>
      {children}
    </button>
  );
}
