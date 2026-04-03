export interface GitHubUser {
  login: string;
  name: string | null;
  avatar_url: string;
  bio: string | null;
  public_repos: number;
  followers: number;
  following: number;
  created_at: string;
}

export interface GitHubRepo {
  name: string;
  html_url: string;
  stargazers_count: number;
  forks_count: number;
  language: string | null;
  fork: boolean;
  archived: boolean;
}

export interface ProfileStats {
  user: GitHubUser;
  repos: GitHubRepo[];
  totalStars: number;
  topLanguages: Language[];
  originalRepos: number;
  forkedRepos: number;
  totalForksReceived: number;
  languageCount: number;
  accountAge: number;
  followerRatio: string;
}

export interface Language {
  name: string;
  count: number;
  percentage: number;
  color: string;
}

// GraphQL types (when authenticated)
export interface FullProfileStats extends ProfileStats {
  totalContributions: number;
  currentStreak: number;
  longestStreak: number;
  mergedPRs: number;
  openPRs: number;
  closedPRs: number;
  prMergeRate: number;
  closedIssues: number;
  openIssues: number;
  issueCloseRate: number;
  weekendPct: number;
  reposContributedTo: number;
  organizations: number;
  personality: Personality;
  velocity: Velocity;
  avgPerDay: number;
}

export interface Personality {
  label: string;
  description: string;
}

export interface Velocity {
  trend: "up" | "down" | "neutral";
  ratio: number;
}

export interface CompareResult {
  left: ProfileStats | FullProfileStats;
  right: ProfileStats | FullProfileStats;
  isFullData: boolean;
}
