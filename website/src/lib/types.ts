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

// Dashboard types

export interface TrafficDay {
  date: string; // YYYY-MM-DD
  count: number;
  uniques: number;
}

export interface TrafficData {
  count: number;
  uniques: number;
  views: TrafficDay[];
}

export interface CloneData {
  count: number;
  uniques: number;
  clones: TrafficDay[];
}

export interface Referrer {
  referrer: string;
  count: number;
  uniques: number;
}

export interface RepoTraffic {
  repo: string;
  views: TrafficData;
  clones: CloneData;
  referrers: Referrer[];
}

export interface DashboardRepo {
  name: string;
  html_url: string;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  language: string | null;
  fork: boolean;
  archived: boolean;
  description: string | null;
  updated_at: string;
  totalViews: number;
  totalClones: number;
  uniqueVisitors: number;
}

export interface DashboardData {
  user: GitHubUser;
  repos: DashboardRepo[];
  totalViews: number;
  totalUniqueVisitors: number;
  totalClones: number;
  totalUniqueCloners: number;
  totalStars: number;
  totalForks: number;
  viewsTimeline: TrafficDay[];
  clonesTimeline: TrafficDay[];
  referrers: Referrer[];
  lastSynced: string;
  // Profile stats (from GraphQL)
  profile: FullProfileStats | null;
}

// Repo detail: commit activity (52 weeks from GitHub Stats API)
export interface WeeklyCommitActivity {
  week: number; // unix timestamp
  total: number;
  days: number[]; // [Sun, Mon, Tue, Wed, Thu, Fri, Sat]
}

// Repo detail: participation (owner vs all, 52 weeks)
export interface ParticipationData {
  all: number[];
  owner: number[];
}

// Extended repo detail data
export interface RepoDetailData {
  traffic: RepoTraffic;
  info: {
    stargazers_count: number;
    forks_count: number;
    open_issues_count: number;
    description: string | null;
    html_url: string;
    language: string | null;
    size: number;
    license: string | null;
    topics: string[];
    created_at: string;
    pushed_at: string;
    has_pages: boolean;
    has_wiki: boolean;
    default_branch: string;
    watchers_count: number;
    subscribers_count: number;
  };
  commitActivity: WeeklyCommitActivity[];
  participation: ParticipationData | null;
}
