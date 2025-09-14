export interface Activity {
  id: string;
  type: string;
  created_at: string;
  repo: { name: string; url?: string };
  payload: any;
  actor: { login: string; avatar_url?: string };
}

export interface BasicStats {
  totalActivities: number;
  pullRequests: { opened: number; closed: number; merged: number };
  issues: { opened: number; closed: number; commented: number };
  commits: number;
  topRepos: { name: string; count: number }[];
}

export interface EnhancedStats extends BasicStats {
  // Time-based metrics
  activitiesLast24h: number;
  activitiesLast7d: number;
  activitiesLast30d: number;
  
  // Enhanced PR/Issue metrics
  pullRequestsExtended: { 
    opened: number; 
    closed: number; 
    merged: number; 
    reviewed: number;
    avgTimeToMerge?: number;
    pendingReview: number;
  };
  issuesExtended: { 
    opened: number; 
    closed: number; 
    commented: number;
    avgTimeToClose?: number;
    labelDistribution: Map<string, number>;
  };
  
  // Commit details
  commitsExtended: {
    total: number;
    filesChanged: number;
    additions: number;
    deletions: number;
    byBranch: Map<string, number>;
    commitMessages: string[];
  };
  
  // Repository metrics
  topReposExtended: { 
    name: string; 
    count: number; 
    commits: number;
    prs: number;
    issues: number;
    lastActivity: string;
    stars?: number;
    forks?: number;
    language?: string;
  }[];
  totalReposActive: number;
  repoLanguages: Map<string, number>;
  
  // Collaboration metrics
  collaborators: Map<string, number>;
  mentionsReceived: number;
  reviewsGiven: number;
  reviewsReceived: number;
  teamMembers: string[];
  
  // Activity patterns
  hourlyDistribution: number[];
  dailyDistribution: number[];
  weeklyTrend: { date: string; count: number }[];
  monthlyTrend: { month: string; count: number }[];
  
  // Language stats
  languageBreakdown: Map<string, number>;
  languageActivity: Map<string, { commits: number; prs: number }>;
  
  // Productivity metrics
  streakDays: number;
  longestStreak: number;
  mostProductiveDay: string;
  mostProductiveHour: number;
  avgDailyActivities: number;
  
  // Event type breakdown
  eventTypeDistribution: Map<string, number>;
  
  // Additional GitHub stats
  followers?: number;
  following?: number;
  publicRepos?: number;
  publicGists?: number;
  starredRepos?: number;
}

export interface FilterOptions {
  dateRange: 'today' | '7d' | '30d' | '90d' | 'year' | 'all';
  activityTypes: string[];
  repositories: string[];
  searchQuery: string;
  collaborator?: string;
  language?: string;
  showPrivate: boolean;
}

export interface UserProfile {
  login: string;
  name?: string;
  avatar_url?: string;
  bio?: string;
  company?: string;
  location?: string;
  email?: string;
  blog?: string;
  twitter_username?: string;
  public_repos: number;
  public_gists: number;
  followers: number;
  following: number;
  created_at: string;
  updated_at: string;
}

export interface Repository {
  id: number;
  name: string;
  full_name: string;
  owner: {
    login: string;
    avatar_url?: string;
  };
  private: boolean;
  description?: string;
  fork: boolean;
  created_at: string;
  updated_at: string;
  pushed_at: string;
  homepage?: string;
  size: number;
  stargazers_count: number;
  watchers_count: number;
  language?: string;
  has_issues: boolean;
  has_projects: boolean;
  has_downloads: boolean;
  has_wiki: boolean;
  has_pages: boolean;
  forks_count: number;
  archived: boolean;
  disabled: boolean;
  open_issues_count: number;
  license?: {
    key: string;
    name: string;
  };
  topics?: string[];
  visibility: string;
  default_branch: string;
}

export type ViewMode = 'grid' | 'timeline' | 'analytics' | 'repositories' | 'collaborations' | 'achievements';

export interface DashboardSettings {
  autoRefresh: boolean;
  refreshInterval: number;
  theme: 'light' | 'dark' | 'auto';
  compactMode: boolean;
  showPrivateActivity: boolean;
  notificationsEnabled: boolean;
}