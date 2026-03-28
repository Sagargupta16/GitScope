// GitHub GraphQL API layer

var GITHUB_GRAPHQL = "https://api.github.com/graphql";

async function graphqlQuery(query, token) {
  var response = await fetch(GITHUB_GRAPHQL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + token
    },
    body: JSON.stringify({ query: query })
  });
  if (!response.ok) return null;
  var data = await response.json();
  if (data.errors) {
    console.error("[GPI] GraphQL errors:", data.errors);
    return null;
  }
  return data.data;
}

async function fetchProfileInsights(username, token) {
  var query = `{
    user(login: "${username}") {
      name
      login
      createdAt
      followers { totalCount }
      following { totalCount }
      repositories(first: 100, ownerAffiliations: OWNER, orderBy: {field: STARGAZERS, direction: DESC}) {
        totalCount
        nodes {
          name
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
  }`;

  return await graphqlQuery(query, token);
}

async function fetchPublicStats(username) {
  // Fallback using REST API (no token needed for public profiles)
  var response = await fetch("https://api.github.com/users/" + username);
  if (!response.ok) return null;
  return await response.json();
}
