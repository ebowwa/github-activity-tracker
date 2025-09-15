// Hooks
export { useGitHubData } from './hooks/useGitHubData';

// Components
export { GitHubStatsCard } from './components/GitHubStatsCard';
export { ActivityFeed } from './components/ActivityFeed';
export { RateLimitBadge } from './components/RateLimitBadge';

// Utils
export { calculateStats } from './utils/stats';
export { filterActivities, getUniqueRepos, getUniqueActivityTypes } from './utils/filters';

// Types
export type {
  GitHubActivity,
  GitHubStats,
  RateLimitInfo,
  GitHubConfig,
  UseGitHubDataOptions,
  FilterOptions,
  ActivityType,
  RepoActivity,
  DayActivity,
} from './types';

// Component Props Types
export type { GitHubStatsCardProps } from './components/GitHubStatsCard';
export type { ActivityFeedProps } from './components/ActivityFeed';
export type { RateLimitBadgeProps } from './components/RateLimitBadge';