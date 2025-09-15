import { format } from 'date-fns';
import type { GitHubActivity, GitHubStats, RepoActivity, DayActivity } from '../types';

export function calculateStats(activities: GitHubActivity[]): GitHubStats {
  const repoCount = new Map<string, number>();
  const dayCount = new Map<string, number>();
  const repoDetails = new Map<string, RepoActivity>();

  let pullRequests = 0;
  let issues = 0;
  let commits = 0;
  let reviews = 0;
  let stars = 0;
  let forks = 0;

  activities.forEach(activity => {
    // Count by repo
    const repoName = activity.repo.name;
    repoCount.set(repoName, (repoCount.get(repoName) || 0) + 1);

    // Initialize repo details
    if (!repoDetails.has(repoName)) {
      repoDetails.set(repoName, {
        name: repoName,
        count: 0,
        commits: 0,
        prs: 0,
        issues: 0,
        lastActivity: activity.created_at,
      });
    }

    const details = repoDetails.get(repoName)!;
    details.count++;

    // Count by day
    const day = format(new Date(activity.created_at), 'yyyy-MM-dd');
    dayCount.set(day, (dayCount.get(day) || 0) + 1);

    // Count by type
    switch (activity.type) {
      case 'PullRequestEvent':
        pullRequests++;
        details.prs = (details.prs || 0) + 1;
        break;
      case 'IssuesEvent':
        issues++;
        details.issues = (details.issues || 0) + 1;
        break;
      case 'PushEvent':
        const commitCount = activity.payload?.commits?.length || 0;
        commits += commitCount;
        details.commits = (details.commits || 0) + commitCount;
        break;
      case 'PullRequestReviewEvent':
        reviews++;
        break;
      case 'WatchEvent':
        if (activity.payload?.action === 'started') {
          stars++;
        }
        break;
      case 'ForkEvent':
        forks++;
        break;
    }

    // Update last activity
    if (new Date(activity.created_at) > new Date(details.lastActivity!)) {
      details.lastActivity = activity.created_at;
    }
  });

  // Get top repos
  const topRepos: RepoActivity[] = Array.from(repoDetails.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Get activity by day
  const activityByDay: DayActivity[] = Array.from(dayCount.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-30) // Last 30 days
    .map(([date, count]) => ({ date, count }));

  return {
    totalActivities: activities.length,
    pullRequests,
    issues,
    commits,
    reviews,
    stars,
    forks,
    topRepos,
    activityByDay,
  };
}