import React from 'react';
import type { GitHubStats } from '../types';

export interface GitHubStatsCardProps {
  stats: GitHubStats;
  className?: string;
  variant?: 'dark' | 'light';
}

export function GitHubStatsCard({ stats, className = '', variant = 'dark' }: GitHubStatsCardProps) {
  const baseClasses = variant === 'dark'
    ? 'bg-gray-800 text-gray-100'
    : 'bg-white text-gray-900';

  return (
    <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 ${className}`}>
      <div className={`${baseClasses} p-6 rounded-lg shadow-lg`}>
        <h3 className={`text-sm ${variant === 'dark' ? 'text-gray-400' : 'text-gray-600'} mb-2`}>
          Total Activities
        </h3>
        <p className="text-3xl font-bold">{stats.totalActivities}</p>
      </div>

      <div className={`${baseClasses} p-6 rounded-lg shadow-lg`}>
        <h3 className={`text-sm ${variant === 'dark' ? 'text-gray-400' : 'text-gray-600'} mb-2`}>
          Pull Requests
        </h3>
        <p className="text-3xl font-bold text-green-500">{stats.pullRequests}</p>
      </div>

      <div className={`${baseClasses} p-6 rounded-lg shadow-lg`}>
        <h3 className={`text-sm ${variant === 'dark' ? 'text-gray-400' : 'text-gray-600'} mb-2`}>
          Issues
        </h3>
        <p className="text-3xl font-bold text-yellow-500">{stats.issues}</p>
      </div>

      <div className={`${baseClasses} p-6 rounded-lg shadow-lg`}>
        <h3 className={`text-sm ${variant === 'dark' ? 'text-gray-400' : 'text-gray-600'} mb-2`}>
          Commits
        </h3>
        <p className="text-3xl font-bold text-blue-500">{stats.commits}</p>
      </div>
    </div>
  );
}