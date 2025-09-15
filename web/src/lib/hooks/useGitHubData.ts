import { useState, useEffect, useCallback, useRef } from 'react';
import { Octokit } from '@octokit/rest';
import type {
  GitHubActivity,
  GitHubStats,
  RateLimitInfo,
  UseGitHubDataOptions,
  FilterOptions,
} from '../types';
import { calculateStats } from '../utils/stats';
import { filterActivities } from '../utils/filters';

export function useGitHubData(options: UseGitHubDataOptions) {
  const { config, onError, onRateLimitWarning } = options;
  const [activities, setActivities] = useState<GitHubActivity[]>([]);
  const [filteredActivities, setFilteredActivities] = useState<GitHubActivity[]>([]);
  const [stats, setStats] = useState<GitHubStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rateLimit, setRateLimit] = useState<RateLimitInfo | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [filters, setFilters] = useState<FilterOptions>({});

  const octokitRef = useRef<Octokit | null>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const cacheRef = useRef<Map<string, { data: any; timestamp: number }>>(new Map());

  // Initialize Octokit instance
  useEffect(() => {
    if (config.token) {
      octokitRef.current = new Octokit({ auth: config.token });
    }
  }, [config.token]);

  // Cache management
  const getCached = useCallback((key: string) => {
    if (!config.cacheEnabled) return null;

    const cached = cacheRef.current.get(key);
    if (!cached) return null;

    const age = Date.now() - cached.timestamp;
    const maxAge = config.cacheDuration || 5 * 60 * 1000; // 5 minutes default

    if (age > maxAge) {
      cacheRef.current.delete(key);
      return null;
    }

    return cached.data;
  }, [config.cacheEnabled, config.cacheDuration]);

  const setCache = useCallback((key: string, data: any) => {
    if (config.cacheEnabled) {
      cacheRef.current.set(key, { data, timestamp: Date.now() });
    }
  }, [config.cacheEnabled]);

  // Check rate limit
  const checkRateLimit = useCallback(async (): Promise<RateLimitInfo | null> => {
    if (!octokitRef.current) return null;

    try {
      const { data } = await octokitRef.current.rateLimit.get();
      const core = data.rate;

      const info: RateLimitInfo = {
        remaining: core.remaining,
        reset: new Date(core.reset * 1000),
        limit: core.limit,
        used: core.used,
      };

      setRateLimit(info);

      if (info.remaining < 10 && onRateLimitWarning) {
        onRateLimitWarning(info);
      }

      return info;
    } catch (err) {
      console.error('Failed to check rate limit:', err);
      return null;
    }
  }, [onRateLimitWarning]);

  // Fetch activities
  const fetchActivities = useCallback(async () => {
    if (!config.token || !octokitRef.current) {
      setError('GitHub token is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Check rate limit first
      const rateLimitInfo = await checkRateLimit();
      if (rateLimitInfo && rateLimitInfo.remaining < 5) {
        setError(`Rate limit too low. Resets at ${rateLimitInfo.reset.toLocaleTimeString()}`);
        setLoading(false);
        return;
      }

      // Get user info
      const username = config.username || (await octokitRef.current.users.getAuthenticated()).data.login;

      // Check cache
      const cacheKey = `activities-${username}`;
      const cached = getCached(cacheKey);
      if (cached) {
        setActivities(cached);
        setStats(calculateStats(cached));
        setLastUpdated(new Date());
        setLoading(false);
        return;
      }

      // Fetch events
      const allEvents: GitHubActivity[] = [];
      const maxPages = config.maxPages || 3;

      for (let page = 1; page <= maxPages; page++) {
        const { data: events } = await octokitRef.current.activity.listEventsForAuthenticatedUser({
          username,
          per_page: 100,
          page,
        });
        allEvents.push(...(events as GitHubActivity[]));
      }

      // Update state
      setActivities(allEvents);
      setStats(calculateStats(allEvents));
      setLastUpdated(new Date());
      setCache(cacheKey, allEvents);

    } catch (err: any) {
      const errorMessage = err.message || 'Failed to fetch GitHub data';
      setError(errorMessage);
      if (onError) {
        onError(err);
      }
    } finally {
      setLoading(false);
    }
  }, [config, checkRateLimit, getCached, setCache, onError]);

  // Apply filters
  useEffect(() => {
    const filtered = filterActivities(activities, filters);
    setFilteredActivities(filtered);

    if (filtered.length > 0) {
      setStats(calculateStats(filtered));
    }
  }, [activities, filters]);

  // Auto-refresh
  useEffect(() => {
    if (config.autoRefresh && config.token && config.refreshInterval) {
      refreshIntervalRef.current = setInterval(() => {
        if (rateLimit && rateLimit.remaining > 20) {
          fetchActivities();
        }
      }, config.refreshInterval);

      return () => {
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current);
        }
      };
    }
  }, [config.autoRefresh, config.token, config.refreshInterval, rateLimit, fetchActivities]);

  // Public API
  return {
    // Data
    activities: filteredActivities,
    stats,
    rateLimit,
    lastUpdated,

    // State
    loading,
    error,

    // Actions
    fetchActivities,
    refresh: fetchActivities,
    setFilters,
    clearCache: () => cacheRef.current.clear(),

    // Utils
    checkRateLimit,
  };
}