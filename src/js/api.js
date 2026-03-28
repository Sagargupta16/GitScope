// GitHub GraphQL API - parameterized queries via background service worker

import { getCached, setCache } from "./storage.js";

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

function sendMessage(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      resolve(response);
    });
  });
}

export async function fetchProfileInsights(username, token) {
  const cacheKey = `gpi_profile_${username}`;
  const cached = await getCached(cacheKey);
  if (cached) {
    console.log("[GPI] Using cached data for", username);
    return cached;
  }

  const data = await sendMessage({
    type: "GPI_GRAPHQL",
    token,
    query: PROFILE_QUERY,
    variables: { username }
  });

  if (data) {
    await setCache(cacheKey, data);
  }
  return data;
}
