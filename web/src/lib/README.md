# GitHub Activity Tracker Library

A composable React library for fetching and displaying GitHub activity data with built-in rate limiting, caching, and customizable components.

## Installation

```bash
npm install @your-org/github-activity-tracker
# or
yarn add @your-org/github-activity-tracker
```

## Quick Start

```tsx
import { useGitHubData, GitHubStatsCard, ActivityFeed, RateLimitBadge } from '@your-org/github-activity-tracker';

function MyGitHubDashboard() {
  const {
    activities,
    stats,
    rateLimit,
    loading,
    error,
    fetchActivities
  } = useGitHubData({
    config: {
      token: 'your-github-token',
      autoRefresh: true,
      refreshInterval: 300000, // 5 minutes
    }
  });

  useEffect(() => {
    fetchActivities();
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <RateLimitBadge rateLimit={rateLimit} />
      {stats && <GitHubStatsCard stats={stats} />}
      <ActivityFeed activities={activities} />
    </div>
  );
}
```

## Core Hook: useGitHubData

The main hook for fetching GitHub data:

```tsx
const {
  activities,      // Filtered GitHub activities
  stats,          // Calculated statistics
  rateLimit,      // Current API rate limit info
  lastUpdated,    // Last fetch timestamp
  loading,        // Loading state
  error,          // Error message if any
  fetchActivities,// Function to fetch data
  setFilters,     // Function to apply filters
  checkRateLimit, // Function to check rate limit
  clearCache,     // Function to clear cache
} = useGitHubData({
  config: {
    token: 'github-token',        // Required
    username: 'optional-username', // Optional, will auto-detect
    autoRefresh: true,             // Enable auto-refresh
    refreshInterval: 300000,       // Refresh interval in ms
    maxPages: 3,                   // Max pages to fetch (100 items/page)
    cacheEnabled: true,            // Enable caching
    cacheDuration: 300000,         // Cache duration in ms
  },
  onError: (error) => console.error(error),
  onRateLimitWarning: (info) => console.warn('Low rate limit:', info),
});
```

## Components

### GitHubStatsCard

Display GitHub statistics in a card layout:

```tsx
<GitHubStatsCard
  stats={stats}
  variant="dark" // or "light"
  className="my-4"
/>
```

### ActivityFeed

Display a scrollable list of recent activities:

```tsx
<ActivityFeed
  activities={activities}
  maxItems={20}
  variant="dark"
  onActivityClick={(activity) => console.log(activity)}
/>
```

### RateLimitBadge

Display API rate limit information:

```tsx
<RateLimitBadge
  rateLimit={rateLimit}
  variant="compact" // or "full"
/>
```

## Filtering Activities

Apply filters to activities:

```tsx
const { setFilters } = useGitHubData(options);

// Filter by date range
setFilters({ dateRange: '7d' }); // today, 7d, 30d, 90d, all

// Filter by activity types
setFilters({
  activityTypes: ['PushEvent', 'PullRequestEvent']
});

// Filter by repositories
setFilters({
  repositories: ['repo1', 'repo2']
});

// Search query
setFilters({
  searchQuery: 'bug fix'
});

// Custom date range
setFilters({
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-12-31'),
});
```

## Utility Functions

### calculateStats

Calculate statistics from activities:

```tsx
import { calculateStats } from '@your-org/github-activity-tracker';

const stats = calculateStats(activities);
// Returns: totalActivities, pullRequests, issues, commits, etc.
```

### filterActivities

Filter activities manually:

```tsx
import { filterActivities } from '@your-org/github-activity-tracker';

const filtered = filterActivities(activities, {
  dateRange: '30d',
  activityTypes: ['PullRequestEvent'],
});
```

## TypeScript Support

The library is fully typed. Import types as needed:

```tsx
import type {
  GitHubActivity,
  GitHubStats,
  RateLimitInfo,
  FilterOptions,
} from '@your-org/github-activity-tracker';
```

## Styling

Components use Tailwind CSS classes. Ensure Tailwind is configured in your project:

```css
/* Your main CSS file */
@import 'tailwindcss';
```

## Advanced Usage

### Custom Activity Processing

```tsx
const { activities } = useGitHubData(options);

// Custom processing
const customStats = activities.reduce((acc, activity) => {
  // Your custom logic
  return acc;
}, {});
```

### Integration with State Management

```tsx
// With Redux/Zustand/etc
const { activities, stats } = useGitHubData({
  config: { token },
  onError: (error) => dispatch(setError(error)),
});

useEffect(() => {
  if (stats) {
    dispatch(updateGitHubStats(stats));
  }
}, [stats]);
```

### Custom Components

Build your own components using the hook:

```tsx
function CustomGitHubWidget() {
  const { activities, loading } = useGitHubData(options);

  return (
    <div className="custom-widget">
      {activities.map(activity => (
        <CustomActivityItem key={activity.id} activity={activity} />
      ))}
    </div>
  );
}
```

## License

MIT