// GitHub GraphQL API - parameterized queries (no string injection)

import { getCached, setCache } from "./storage.js";

const GITHUB_GRAPHQL = "https://api.github.com/graphql";

const PROFILE_QUERY = `
  query ProfileInsights($username: String!) {
    user(login: $username) {
      name
      login
      createdAt
      avatarUrl
      followers { totalCount }
      following { totalCount }
      starredRepositories { totalCount }
      gists { totalCount }
      organizations(first: 5) {
        nodes { login avatarUrl name }
      }
      repositories(first: 100, ownerAffiliations: OWNER, orderBy: {field: STARGAZERS, direction: DESC}) {
        totalCount
        nodes {
          name
          url
          stargazerCount
          forkCount
          primaryLanguage { name color }
          updatedAt
          isArchived
          isFork
        }
      }
      pullRequests(states: MERGED, first: 1) { totalCount }
      openPRs: pullRequests(states: OPEN, first: 1) { totalCount }
      closedPRs: pullRequests(states: CLOSED, first: 1) { totalCount }
      issues(first: 1) { totalCount }
      repositoryDiscussionComments(onlyAnswers: true, first: 1) { totalCount }
      contributionsCollection {
        totalCommitContributions
        totalPullRequestContributions
        totalPullRequestReviewContributions
        totalIssueContributions
        totalRepositoryContributions
        contributionCalendar {
          totalContributions
          weeks {
            contributionDays {
              contributionCount
              date
              weekday
            }
          }
        }
      }
    }
  }
`;

async function graphqlQuery(query, variables, token) {
  const response = await fetch(GITHUB_GRAPHQL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({ query, variables })
  });

  if (!response.ok) return null;

  const data = await response.json();
  if (data.errors) {
    console.error("[GPI] GraphQL errors:", data.errors);
    return null;
  }
  return data.data;
}

export async function fetchProfileInsights(username, token) {
  // Check cache first
  const cacheKey = `gpi_profile_${username}`;
  const cached = await getCached(cacheKey);
  if (cached) {
    console.log("[GPI] Using cached data for", username);
    return cached;
  }

  const data = await graphqlQuery(PROFILE_QUERY, { username }, token);
  if (data) {
    await setCache(cacheKey, data);
  }
  return data;
}
