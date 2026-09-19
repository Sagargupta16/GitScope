import type { GitHubRepo, GitHubUser } from "./types";
import { createGitHubClient, throwIfAborted } from "./http";

export interface LeaderboardEntry {
  login: string;
  name: string | null;
  avatar_url: string;
  public_repos: number;
  followers: number;
  following: number;
  public_gists: number;
  created_at: string;
  totalStars: number;
  totalForks: number;
  languageCount: number;
  isViewer: boolean;
}

type Client = ReturnType<typeof createGitHubClient>;

async function userWithStats(username: string, client: Client): Promise<LeaderboardEntry> {
  const path = `/users/${encodeURIComponent(username)}`;
  const user = await client.request<GitHubUser & { public_gists: number }>(path);
  const repos = await client.paginate<GitHubRepo>(
    `${path}/repos?sort=full_name&direction=asc`, (repo) => repo.html_url,
  );
  const languages = new Set(repos.filter((repo) => !repo.fork && !repo.archived && repo.language).map((repo) => repo.language));
  return {
    login: user.login, name: user.name, avatar_url: user.avatar_url,
    public_repos: user.public_repos, followers: user.followers, following: user.following,
    public_gists: user.public_gists, created_at: user.created_at,
    totalStars: repos.reduce((total, repo) => total + repo.stargazers_count, 0),
    totalForks: repos.reduce((total, repo) => total + repo.forks_count, 0),
    languageCount: languages.size, isViewer: false,
  };
}

async function following(client: Client): Promise<string[]> {
  const users = await client.paginate<{ login: string }>(
    "/user/following", (user) => user.login.toLowerCase(),
  );
  return users.map((user) => user.login);
}

async function allUsers(
  usernames: string[], client: Client, viewerLogin: string,
  onProgress?: (message: string) => void, signal?: AbortSignal,
): Promise<LeaderboardEntry[]> {
  const uniqueUsers = [...new Map(usernames.map((login) => [login.toLowerCase(), login])).values()];
  const results: LeaderboardEntry[] = [];
  for (let index = 0; index < uniqueUsers.length; index += 5) {
    throwIfAborted(signal);
    const batch = uniqueUsers.slice(index, index + 5);
    onProgress?.(`Fetching ${index + 1}-${index + batch.length} of ${uniqueUsers.length}...`);
    // Reject the ranking if any user is incomplete; omission changes rank.
    const entries = await Promise.all(batch.map((username) => userWithStats(username, client)));
    results.push(...entries.map((entry) => ({
      ...entry, isViewer: entry.login.toLowerCase() === viewerLogin.toLowerCase(),
    })));
  }
  throwIfAborted(signal);
  return results;
}

export async function fetchUserWithStats(username: string, token: string, signal?: AbortSignal): Promise<LeaderboardEntry> {
  return userWithStats(username, createGitHubClient(token, signal));
}

export async function fetchFollowing(token: string, signal?: AbortSignal): Promise<string[]> {
  return following(createGitHubClient(token, signal));
}

export async function fetchAllUsers(
  usernames: string[], token: string, viewerLogin: string,
  onProgress?: (message: string) => void, signal?: AbortSignal,
): Promise<LeaderboardEntry[]> {
  return allUsers(usernames, createGitHubClient(token, signal), viewerLogin, onProgress, signal);
}

export async function fetchLeaderboard(token: string, signal?: AbortSignal): Promise<LeaderboardEntry[]> {
  const client = createGitHubClient(token, signal);
  const viewer = await client.request<GitHubUser>("/user");
  const logins = await following(client);
  return allUsers([viewer.login, ...logins], client, viewer.login, undefined, signal);
}
