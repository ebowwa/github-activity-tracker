export interface GitHubActivity {
  id: string;
  type: string;
  created_at: string;
  repo: {
    name: string;
    url?: string;
  };
  payload: any;
  actor: {
    login: string;
    avatar_url?: string;
  };
}

export interface RateLimitInfo {
  remaining: number;
  reset: Date;
  limit: number;
  used: number;
}

export interface GitHubStats {
  totalActivities: number;
  pullRequests: number;
  issues: number;
  commits: number;
  reviews: number;
  stars: number;
  forks: number;
  topRepos: RepoActivity[];
  activityByDay: DayActivity[];
  languageBreakdown?: Map<string, number>;
}

export interface RepoActivity {
  name: string;
  count: number;
  commits?: number;
  prs?: number;
  issues?: number;
  lastActivity?: string;
}

export interface DayActivity {
  date: string;
  count: number;
}

export interface GitHubConfig {
  token: string;
  username?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
  maxPages?: number;
  cacheEnabled?: boolean;
  cacheDuration?: number;
}

export interface UseGitHubDataOptions {
  config: GitHubConfig;
  onError?: (error: Error) => void;
  onRateLimitWarning?: (info: RateLimitInfo) => void;
}

export type ActivityType =
  | 'PushEvent'
  | 'PullRequestEvent'
  | 'IssuesEvent'
  | 'PullRequestReviewEvent'
  | 'CreateEvent'
  | 'DeleteEvent'
  | 'ForkEvent'
  | 'WatchEvent'
  | 'ReleaseEvent'
  | 'PublicEvent'
  | 'MemberEvent'
  | 'CommitCommentEvent';

export interface FilterOptions {
  dateRange?: 'today' | '7d' | '30d' | '90d' | 'all';
  activityTypes?: ActivityType[];
  repositories?: string[];
  searchQuery?: string;
  startDate?: Date;
  endDate?: Date;
}