const API = "https://api.github.com";

export type GitHubErrorKind =
  | "rate-limit" | "unauthorized" | "forbidden" | "not-found"
  | "timeout" | "network" | "pending" | "graphql" | "invalid-response" | "http";

export class GitHubApiError extends Error {
  constructor(
    message: string,
    public readonly kind: GitHubErrorKind,
    public readonly status?: number,
    public readonly retryAfter?: string,
  ) {
    super(message);
    this.name = "GitHubApiError";
  }
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw signal.reason ?? new DOMException("Request cancelled", "AbortError");
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "GitHub request failed";
}

function classify(status: number, headers: Headers, message: string): GitHubApiError {
  const rateLimited = status === 429 || (status === 403 && (
    headers.get("x-ratelimit-remaining") === "0" ||
    headers.has("retry-after") || /rate.?limit|abuse detection/i.test(message)
  ));
  if (rateLimited) return new GitHubApiError(
    "GitHub API rate limit exceeded. Please wait before refreshing.",
    "rate-limit", status, headers.get("retry-after") ?? headers.get("x-ratelimit-reset") ?? undefined,
  );
  const kind = status === 401 ? "unauthorized" : status === 403 ? "forbidden"
    : status === 404 ? "not-found" : "http";
  const prefix = status === 401 ? "GitHub authentication failed. Please sign in again."
    : status === 403 ? "GitHub denied access to this resource."
    : status === 404 ? "GitHub resource not found."
    : `GitHub API error: ${status}.`;
  return new GitHubApiError(`${prefix}${message ? ` ${message}` : ""}`, kind, status);
}

function apiUrl(path: string): URL {
  const url = new URL(path, API);
  // Never forward an access token to a host supplied by a pagination header.
  if (url.origin !== API || url.username || url.password) {
    throw new GitHubApiError("Invalid GitHub pagination URL", "invalid-response");
  }
  return url;
}

/** One client per user operation. Once rate limited, no further requests start. */
export function createGitHubClient(token?: string, signal?: AbortSignal) {
  let rateError: GitHubApiError | undefined;

  async function response<T>(path: string, init: RequestInit = {}): Promise<{ data: T; headers: Headers }> {
    throwIfAborted(signal);
    if (rateError) throw rateError;
    const url = apiUrl(path);
    const controller = new AbortController();
    const onAbort = () => controller.abort(signal?.reason);
    signal?.addEventListener("abort", onAbort, { once: true });
    const timeout = setTimeout(() => controller.abort(
      new GitHubApiError("GitHub request timed out. Please try again.", "timeout"),
    ), 15_000);
    try {
      const headers = new Headers(init.headers);
      headers.set("Accept", "application/vnd.github+json");
      headers.set("X-GitHub-Api-Version", "2022-11-28");
      if (token) headers.set("Authorization", `bearer ${token}`);
      const res = await fetch(url.toString(), { ...init, headers, signal: controller.signal });
      if (res.status === 202 || res.status === 204) {
        throw new GitHubApiError("GitHub statistics are still being prepared.", "pending", res.status);
      }
      let body: unknown;
      try { body = await res.json(); } catch {
        if (controller.signal.aborted) throw controller.signal.reason;
        if (res.ok) throw new GitHubApiError("GitHub returned an invalid response.", "invalid-response", res.status);
      }
      if (!res.ok) {
        const message = body && typeof body === "object" && "message" in body ? String(body.message) : "";
        const error = classify(res.status, res.headers, message);
        if (error.kind === "rate-limit") rateError = error;
        throw error;
      }
      throwIfAborted(signal);
      return { data: body as T, headers: res.headers };
    } catch (error) {
      throwIfAborted(signal);
      if (controller.signal.aborted) throw controller.signal.reason;
      if (error instanceof GitHubApiError) throw error;
      throw new GitHubApiError("Could not reach GitHub. Check your connection and try again.", "network");
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", onAbort);
    }
  }

  async function request<T>(path: string): Promise<T> {
    return (await response<T>(path)).data;
  }

  async function graphql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
    const { data: envelope } = await response<{
      data?: T; errors?: { message: string; type?: string }[];
    }>("/graphql", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
    });
    if (!envelope || typeof envelope !== "object" ||
      (envelope.errors !== undefined && !Array.isArray(envelope.errors))) {
      throw new GitHubApiError("GitHub returned incomplete GraphQL data.", "invalid-response");
    }
    if (envelope.errors?.length) {
      const message = envelope.errors.map((error) => error.message).join("; ");
      const limited = envelope.errors.some((error) => error.type === "RATE_LIMITED") || /rate.?limit/i.test(message);
      const error = new GitHubApiError(
        limited ? "GitHub API rate limit exceeded. Please wait before refreshing." : `GitHub GraphQL error: ${message}`,
        limited ? "rate-limit" : "graphql", 200,
      );
      if (limited) rateError = error;
      throw error;
    }
    if (!envelope.data) throw new GitHubApiError("GitHub returned incomplete GraphQL data.", "invalid-response");
    return envelope.data;
  }

  async function paginate<T>(path: string, key?: (item: T) => string): Promise<T[]> {
    let url: URL | null = apiUrl(path);
    url.searchParams.set("per_page", "100");
    if (!url.searchParams.has("page")) url.searchParams.set("page", "1");
    const seenPages = new Set<string>();
    const seenItems = new Set<string>();
    const all: T[] = [];
    while (url) {
      if (seenPages.has(url.href)) throw new GitHubApiError("GitHub pagination did not advance.", "invalid-response");
      seenPages.add(url.href);
      const { data, headers } = await response<T[]>(url.href);
      if (!Array.isArray(data)) throw new GitHubApiError("GitHub returned an invalid page.", "invalid-response");
      let added = 0;
      for (const item of data) {
        const id = key?.(item);
        if (id !== undefined && seenItems.has(id)) continue;
        if (id !== undefined) seenItems.add(id);
        all.push(item);
        added++;
      }
      const link = headers.get("link");
      const next = link?.match(/<([^>]+)>;\s*rel="next"/)?.[1];
      if (next) {
        const nextUrl = apiUrl(next);
        if (nextUrl.pathname !== url.pathname) throw new GitHubApiError("Invalid GitHub pagination path.", "invalid-response");
        url = nextUrl;
      } else if (!link && data.length === 100) {
        url.searchParams.set("page", String(Number(url.searchParams.get("page")) + 1));
      } else {
        url = null;
      }
      if (url && key && added === 0) throw new GitHubApiError("GitHub pagination did not advance.", "invalid-response");
    }
    return all;
  }

  async function statistics<T>(path: string): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try { return await request<T>(path); } catch (error) {
        if (!(error instanceof GitHubApiError) || error.kind !== "pending" || attempt >= 2) throw error;
        // Keep optional statistics retries short; a later refresh can finish them.
        await new Promise<void>((resolve, reject) => {
          const onAbort = () => {
            clearTimeout(timer);
            signal?.removeEventListener("abort", onAbort);
            reject(signal?.reason ?? new DOMException("Request cancelled", "AbortError"));
          };
          const timer = setTimeout(() => { signal?.removeEventListener("abort", onAbort); resolve(); }, 150 * (attempt + 1));
          signal?.addEventListener("abort", onAbort, { once: true });
          if (signal?.aborted) onAbort();
        });
      }
    }
  }

  return { request, graphql, paginate, statistics, get rateLimited() { return Boolean(rateError); } };
}
