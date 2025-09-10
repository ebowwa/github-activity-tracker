export interface GitHubActivity {
  id: string;
  type: string;
  actor: {
    login: string;
    display_login?: string;
    avatar_url: string;
  };
  repo: {
    name: string;
    url: string;
  };
  payload: any;
  public: boolean;
  created_at: string;
  org?: {
    login: string;
    avatar_url: string;
  };
}

export interface ProcessedActivity {
  id: string;
  type: string;
  action: string;
  repo: string;
  description: string;
  timestamp: Date;
  url?: string;
  details?: Record<string, any>;
}

export interface ActivitySummary {
  totalActivities: number;
  byType: Record<string, number>;
  byRepo: Record<string, number>;
  byDay: Record<string, number>;
  recentActivities: ProcessedActivity[];
  pullRequests: {
    opened: number;
    closed: number;
    merged: number;
    reviewed: number;
  };
  issues: {
    opened: number;
    closed: number;
    commented: number;
  };
  commits: {
    total: number;
    repos: string[];
  };
}

export interface PRDetails {
  number: number;
  title: string;
  state: string;
  merged: boolean;
  created_at: string;
  closed_at?: string;
  merged_at?: string;
  html_url: string;
  repo: string;
}

export interface IssueDetails {
  number: number;
  title: string;
  state: string;
  created_at: string;
  closed_at?: string;
  html_url: string;
  repo: string;
  comments: number;
}