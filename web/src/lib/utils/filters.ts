import { isWithinInterval, startOfDay, endOfDay, subDays } from 'date-fns';
import type { GitHubActivity, FilterOptions } from '../types';

export function filterActivities(
  activities: GitHubActivity[],
  filters: FilterOptions
): GitHubActivity[] {
  let filtered = [...activities];

  // Date range filter
  if (filters.dateRange || filters.startDate || filters.endDate) {
    const now = new Date();
    let start: Date;
    let end: Date = filters.endDate || endOfDay(now);

    if (filters.startDate) {
      start = filters.startDate;
    } else {
      switch (filters.dateRange) {
        case 'today':
          start = startOfDay(now);
          break;
        case '7d':
          start = subDays(now, 7);
          break;
        case '30d':
          start = subDays(now, 30);
          break;
        case '90d':
          start = subDays(now, 90);
          break;
        default:
          start = new Date(0); // Beginning of time
      }
    }

    filtered = filtered.filter(activity => {
      const activityDate = new Date(activity.created_at);
      return isWithinInterval(activityDate, { start, end });
    });
  }

  // Activity type filter
  if (filters.activityTypes && filters.activityTypes.length > 0) {
    filtered = filtered.filter(activity =>
      filters.activityTypes!.includes(activity.type as any)
    );
  }

  // Repository filter
  if (filters.repositories && filters.repositories.length > 0) {
    filtered = filtered.filter(activity =>
      filters.repositories!.includes(activity.repo.name)
    );
  }

  // Search query filter
  if (filters.searchQuery) {
    const query = filters.searchQuery.toLowerCase();
    filtered = filtered.filter(activity => {
      const searchableText = [
        activity.type,
        activity.repo.name,
        activity.actor.login,
        JSON.stringify(activity.payload),
      ].join(' ').toLowerCase();

      return searchableText.includes(query);
    });
  }

  return filtered;
}

export function getUniqueRepos(activities: GitHubActivity[]): string[] {
  const repos = new Set<string>();
  activities.forEach(activity => repos.add(activity.repo.name));
  return Array.from(repos).sort();
}

export function getUniqueActivityTypes(activities: GitHubActivity[]): string[] {
  const types = new Set<string>();
  activities.forEach(activity => types.add(activity.type));
  return Array.from(types).sort();
}