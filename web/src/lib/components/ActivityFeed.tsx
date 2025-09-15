import React from 'react';
import { format } from 'date-fns';
import type { GitHubActivity } from '../types';

export interface ActivityFeedProps {
  activities: GitHubActivity[];
  maxItems?: number;
  className?: string;
  variant?: 'dark' | 'light';
  onActivityClick?: (activity: GitHubActivity) => void;
}

export function ActivityFeed({
  activities,
  maxItems = 20,
  className = '',
  variant = 'dark',
  onActivityClick,
}: ActivityFeedProps) {
  const baseClasses = variant === 'dark'
    ? 'bg-gray-800 text-gray-100'
    : 'bg-white text-gray-900';

  const itemClasses = variant === 'dark'
    ? 'bg-gray-700 hover:bg-gray-600'
    : 'bg-gray-50 hover:bg-gray-100';

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'PushEvent':
        return '📤';
      case 'PullRequestEvent':
        return '🔀';
      case 'IssuesEvent':
        return '📝';
      case 'ForkEvent':
        return '🍴';
      case 'WatchEvent':
        return '⭐';
      case 'CreateEvent':
        return '✨';
      case 'DeleteEvent':
        return '🗑️';
      default:
        return '📌';
    }
  };

  return (
    <div className={`${baseClasses} p-6 rounded-lg shadow-lg ${className}`}>
      <h3 className="text-xl font-semibold mb-4">Recent Activities</h3>
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {activities.slice(0, maxItems).map((activity) => (
          <div
            key={activity.id}
            className={`p-3 ${itemClasses} rounded transition-colors cursor-pointer`}
            onClick={() => onActivityClick?.(activity)}
          >
            <div className="flex justify-between items-start">
              <div className="flex items-start gap-2">
                <span className="text-lg">{getActivityIcon(activity.type)}</span>
                <div>
                  <span className="text-sm font-medium text-blue-400">
                    {activity.type.replace('Event', '')}
                  </span>
                  <span className={`text-sm ml-2 ${variant === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                    in {activity.repo.name}
                  </span>
                </div>
              </div>
              <span className={`text-xs ${variant === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                {format(new Date(activity.created_at), 'MMM dd, HH:mm')}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}