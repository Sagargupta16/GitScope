// Achievement badges for the website, from the same definitions as the
// extension (shared/achievements.json). The website cannot read a profile page
// (GitHub sends no CORS headers for it), so GitHub's own badges show the tier
// the public counts point to, and badges with no public count link to GitHub.

import definitions from "../../../shared/achievements.json";
import { createGitHubClient } from "./http";

export interface AchievementDefinition {
  id: string;
  name: string;
  rule: string;
  thresholds: number[];
  metric: string | null;
  icon: string;
  color: string;
}

export const ACHIEVEMENTS = definitions as {
  iconsLicense: string;
  rims: Record<string, string[]>;
  official: AchievementDefinition[];
  gitscope: AchievementDefinition[];
  icons: Record<string, string[]>;
};

export interface AchievementMetrics {
  counts: Record<string, number | null>;
  // A count that stopped at a page limit, shown as "at least".
  atLeast: Record<string, boolean>;
}

export interface BadgeState {
  level: number;
  count: number | null;
  next: number | null;
  atLeast: boolean;
}

const LOGIN = /^[a-z\d](?:[a-z\d-]{0,38})$/i;
const BOT_AUTHORS = ["app/renovate", "app/dependabot", "app/github-actions"];
const MAINTAINER_PAGES = 3;

export function isGitHubLogin(login: string): boolean {
  return LOGIN.test(login);
}

// The login goes into search qualifiers, so anything else could add a qualifier.
export function searchQueries(login: string) {
  if (!isGitHubLogin(login)) throw new Error("Invalid GitHub username");
  const bots = BOT_AUTHORS.map((bot) => `-author:${bot}`).join(" ");
  return {
    pullShark: `is:pr is:merged author:${login}`,
    openSourcerer: `is:pr is:merged author:${login} -user:${login}`,
    reviewer: `is:pr is:merged reviewed-by:${login} -author:${login}`,
    bugReporter: `is:issue is:closed reason:completed linked:pr author:${login}`,
    maintainer: `is:pr is:merged user:${login} -author:${login} ${bots}`,
    publisher: `"uses: ${login}/" path:.github/workflows -user:${login}`,
  };
}

// level 0 is locked, 1 is the base badge, 2 to 4 are the x2 to x4 tiers.
export function badgeState(definition: AchievementDefinition, metrics: AchievementMetrics | null): BadgeState {
  const raw = definition.metric ? metrics?.counts[definition.metric] : null;
  const count = typeof raw === "number" && Number.isFinite(raw) ? raw : null;
  const level = count === null ? 0 : definition.thresholds.filter((threshold) => count >= threshold).length;
  return {
    level,
    count,
    next: definition.thresholds[level] ?? null,
    atLeast: Boolean(definition.metric && metrics?.atLeast?.[definition.metric]),
  };
}

export function tierLabel(level: number): string {
  return level >= 2 ? `x${level}` : "";
}

interface AnswerNode { discussion?: { author?: { login?: string } | null; repository?: { nameWithOwner?: string } } }
interface MaintainerNode { author?: { __typename?: string; login?: string } | null; repository?: { nameWithOwner?: string } }
interface MaintainerPage { issueCount: number; pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: MaintainerNode[] }
interface HeartNode { reactions?: { totalCount?: number } }

// GitHub turned achievements off in community/community (#106536), and answering
// a discussion you opened yourself does not count either.
export function countableAnswers(nodes: AnswerNode[], login: string): number {
  const self = login.toLowerCase();
  return nodes.filter((node) => {
    const repo = node.discussion?.repository?.nameWithOwner;
    const author = node.discussion?.author?.login?.toLowerCase();
    return repo && repo.toLowerCase() !== "community/community" && author !== self;
  }).length;
}

// Each person's first merged pull request in a repo is a first-time contribution,
// so distinct (person, repo) pairs count them. Bots are skipped by type.
export function firstTimeContributions(nodes: MaintainerNode[]): number {
  const pairs = new Set<string>();
  for (const node of nodes) {
    if (node.author?.__typename !== "User" || !node.author.login || !node.repository?.nameWithOwner) continue;
    pairs.add(`${node.author.login.toLowerCase()}@${node.repository.nameWithOwner.toLowerCase()}`);
  }
  return pairs.size;
}

export function accountYears(createdAt: string, now = new Date()): number | null {
  const created = Date.parse(createdAt);
  if (!Number.isFinite(created)) return null;
  return Math.floor((now.getTime() - created) / (365.25 * 86_400_000));
}

const ACHIEVEMENTS_QUERY = `
  query Achievements($login: String!, $pullShark: String!, $openSourcerer: String!,
    $reviewer: String!, $bugReporter: String!, $maintainer: String!) {
    user(login: $login) {
      login
      createdAt
      repositories(ownerAffiliations: OWNER, first: 1, orderBy: {field: STARGAZERS, direction: DESC}) {
        nodes { stargazerCount }
      }
      answers: repositoryDiscussionComments(onlyAnswers: true, first: 100) {
        totalCount
        nodes { discussion { author { login } repository { nameWithOwner } } }
      }
      issueComments(last: 100) { nodes { reactions(content: HEART) { totalCount } } }
      discussionComments: repositoryDiscussionComments(last: 100) {
        nodes { reactions(content: HEART) { totalCount } }
      }
    }
    pullShark: search(type: ISSUE, query: $pullShark, first: 1) { issueCount }
    openSourcerer: search(type: ISSUE, query: $openSourcerer, first: 1) { issueCount }
    reviewer: search(type: ISSUE, query: $reviewer, first: 1) { issueCount }
    bugReporter: search(type: ISSUE, query: $bugReporter, first: 1) { issueCount }
    maintainer: search(type: ISSUE, query: $maintainer, first: 100) { ...MaintainerPage }
  }
  fragment MaintainerPage on SearchResultItemConnection {
    issueCount
    pageInfo { hasNextPage endCursor }
    nodes { ... on PullRequest { author { __typename login } repository { nameWithOwner } } }
  }
`;

const MAINTAINER_QUERY = `
  query MaintainerPage($query: String!, $after: String!) {
    search(type: ISSUE, query: $query, first: 100, after: $after) {
      issueCount
      pageInfo { hasNextPage endCursor }
      nodes { ... on PullRequest { author { __typename login } repository { nameWithOwner } } }
    }
  }
`;

interface AchievementsResponse {
  user: {
    login: string;
    createdAt: string;
    repositories: { nodes: { stargazerCount: number }[] };
    answers: { totalCount: number; nodes: AnswerNode[] };
    issueComments: { nodes: HeartNode[] };
    discussionComments: { nodes: HeartNode[] };
  } | null;
  pullShark: { issueCount: number };
  openSourcerer: { issueCount: number };
  reviewer: { issueCount: number };
  bugReporter: { issueCount: number };
  maintainer: MaintainerPage;
}

const heartTotal = (nodes: HeartNode[]) => nodes.reduce((sum, node) => sum + (node.reactions?.totalCount ?? 0), 0);

export interface AchievementResult { login: string; metrics: AchievementMetrics }

export async function fetchAchievements(username: string, token: string, signal?: AbortSignal): Promise<AchievementResult> {
  const login = username.trim();
  const queries = searchQueries(login);
  const client = createGitHubClient(token, signal);
  // Code search has its own, much lower rate limit. A separate client keeps one
  // limited search from blocking the GraphQL requests after it.
  const publisher = createGitHubClient(token, signal).request<{ total_count?: number }>(`/search/code?q=${encodeURIComponent(queries.publisher)}&per_page=1`)
    .then((data) => (Number.isInteger(data.total_count) ? data.total_count as number : null))
    .catch(() => null);
  const data = await client.graphql<AchievementsResponse>(ACHIEVEMENTS_QUERY, {
    login, pullShark: queries.pullShark, openSourcerer: queries.openSourcerer,
    reviewer: queries.reviewer, bugReporter: queries.bugReporter, maintainer: queries.maintainer,
  });
  if (!data.user) throw new Error(`No GitHub user named ${login}.`);
  const nodes = [...data.maintainer.nodes];
  let page = data.maintainer;
  for (let pages = 1; page.pageInfo.hasNextPage && page.pageInfo.endCursor && pages < MAINTAINER_PAGES; pages++) {
    page = (await client.graphql<{ search: MaintainerPage }>(MAINTAINER_QUERY, { query: queries.maintainer, after: page.pageInfo.endCursor })).search;
    nodes.push(...page.nodes);
  }
  const answers = data.user.answers;
  return {
    login: data.user.login,
    metrics: {
      counts: {
        mergedPullRequests: data.pullShark.issueCount,
        topRepositoryStars: data.user.repositories.nodes[0]?.stargazerCount ?? 0,
        acceptedAnswers: countableAnswers(answers.nodes, login),
        externalMergedPullRequests: data.openSourcerer.issueCount,
        hearts: heartTotal(data.user.issueComments.nodes) + heartTotal(data.user.discussionComments.nodes),
        reviewedMergedPullRequests: data.reviewer.issueCount,
        fixedIssues: data.bugReporter.issueCount,
        firstTimeContributors: firstTimeContributions(nodes),
        actionDependents: await publisher,
        accountYears: accountYears(data.user.createdAt),
      },
      atLeast: {
        acceptedAnswers: answers.totalCount > answers.nodes.length,
        firstTimeContributors: page.pageInfo.hasNextPage,
      },
    },
  };
}
