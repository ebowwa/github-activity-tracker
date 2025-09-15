import React from 'react';
import { format } from 'date-fns';
import type { RateLimitInfo } from '../types';

export interface RateLimitBadgeProps {
  rateLimit: RateLimitInfo | null;
  className?: string;
  variant?: 'compact' | 'full';
}

export function RateLimitBadge({
  rateLimit,
  className = '',
  variant = 'compact',
}: RateLimitBadgeProps) {
  if (!rateLimit) return null;

  const percentage = (rateLimit.remaining / rateLimit.limit) * 100;
  const statusColor = percentage > 50 ? 'text-green-400' : percentage > 20 ? 'text-yellow-400' : 'text-red-400';

  if (variant === 'compact') {
    return (
      <span className={`inline-flex items-center gap-2 ${className}`}>
        <span className={statusColor}>
          {rateLimit.remaining}/{rateLimit.limit}
        </span>
        <span className="text-xs text-gray-500">
          resets {format(rateLimit.reset, 'HH:mm')}
        </span>
      </span>
    );
  }

  return (
    <div className={`p-3 bg-gray-800 rounded-lg ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-400">API Rate Limit</span>
        <span className={`font-semibold ${statusColor}`}>
          {rateLimit.remaining}/{rateLimit.limit}
        </span>
      </div>
      <div className="w-full bg-gray-700 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all ${
            percentage > 50 ? 'bg-green-400' : percentage > 20 ? 'bg-yellow-400' : 'bg-red-400'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <p className="text-xs text-gray-500 mt-1">
        Resets at {format(rateLimit.reset, 'HH:mm:ss')}
      </p>
    </div>
  );
}