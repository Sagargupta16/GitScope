const TOKEN_KEY = "gitscope_token";
const LOGIN_KEY = "gitscope_login";
const WORKER_URL = "https://gpi-auth.sg85207.workers.dev";

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredLogin(): string | null {
  return localStorage.getItem(LOGIN_KEY);
}

export function storeAuth(token: string, login: string) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(LOGIN_KEY, login);
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(LOGIN_KEY);
}

export function getLoginUrl(): string {
  return `${WORKER_URL}/web/login`;
}

// Extract token from URL hash after OAuth redirect
export function extractTokenFromHash(): string | null {
  const hash = window.location.hash;
  if (!hash) return null;

  const params = new URLSearchParams(hash.slice(1));
  const token = params.get("token");

  if (token) {
    // Clean the hash from URL
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
  }

  return token;
}

export async function fetchAuthenticatedUser(token: string): Promise<string> {
  const res = await fetch("https://api.github.com/user", {
    headers: { Authorization: `bearer ${token}` },
  });
  if (!res.ok) throw new Error("Invalid token");
  const data = await res.json();
  return data.login;
}
