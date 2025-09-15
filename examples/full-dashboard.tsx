import { useState, useEffect, useCallback } from 'react';
import { Octokit } from '@octokit/rest';
import { format, subDays, startOfDay, endOfDay, isWithinInterval } from 'date-fns';

interface Activity {
  id: string;
  type: string;
  created_at: string;
  repo: { name: string };
  payload: any;
  actor: { login: string };
}

interface RateLimitInfo {
  remaining: number;
  reset: Date;
  limit: number;
}

interface Stats {
  totalActivities: number;
  pullRequests: number;
  issues: number;
  commits: number;
  reviews: number;
  topRepos: { name: string; count: number }[];
  activityByDay: { date: string; count: number }[];
}

function App() {
  const [token, setToken] = useState('');
  const [activities, setActivities] = useState<Activity[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [username, setUsername] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [rateLimit, setRateLimit] = useState<RateLimitInfo | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(300000); // 5 minutes default

  // Load token from localStorage on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('github-tracker-token');
    if (savedToken) {
      setToken(savedToken);
    }
  }, []);

  // Calculate stats from activities
  const calculateStats = useCallback((activityList: Activity[]): Stats => {
    const repoCount = new Map<string, number>();
    const dayCount = new Map<string, number>();

    let pullRequests = 0;
    let issues = 0;
    let commits = 0;
    let reviews = 0;

    activityList.forEach(activity => {
      // Count by repo
      const repoName = activity.repo.name;
      repoCount.set(repoName, (repoCount.get(repoName) || 0) + 1);

      // Count by day
      const day = format(new Date(activity.created_at), 'yyyy-MM-dd');
      dayCount.set(day, (dayCount.get(day) || 0) + 1);

      // Count by type
      switch (activity.type) {
        case 'PullRequestEvent':
          pullRequests++;
          break;
        case 'IssuesEvent':
          issues++;
          break;
        case 'PushEvent':
          commits += activity.payload?.commits?.length || 0;
          break;
        case 'PullRequestReviewEvent':
          reviews++;
          break;
      }
    });

    // Get top repos
    const topRepos = Array.from(repoCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    // Get activity by day
    const activityByDay = Array.from(dayCount.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-7)
      .map(([date, count]) => ({ date, count }));

    return {
      totalActivities: activityList.length,
      pullRequests,
      issues,
      commits,
      reviews,
      topRepos,
      activityByDay
    };
  }, []);

  // Fetch activities with rate limit handling
  const fetchActivities = useCallback(async (tokenToUse: string) => {
    if (!tokenToUse) {
      setError('Please enter a GitHub token');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const octokit = new Octokit({ auth: tokenToUse });

      // Get authenticated user
      const { data: user } = await octokit.users.getAuthenticated();
      setUsername(user.login);

      // Check rate limit first
      const { data: rateLimitData } = await octokit.rateLimit.get();
      const core = rateLimitData.rate;

      setRateLimit({
        remaining: core.remaining,
        reset: new Date(core.reset * 1000),
        limit: core.limit
      });

      // If rate limit is low, show warning
      if (core.remaining < 10) {
        const resetTime = new Date(core.reset * 1000);
        setError(`Rate limit low. Resets at ${resetTime.toLocaleTimeString()}`);
        setLoading(false);
        return;
      }

      // Fetch events (max 100 per page, up to 3 pages)
      const allEvents: Activity[] = [];
      const maxPages = Math.min(3, Math.floor(core.remaining / 3)); // Use available rate limit wisely

      for (let page = 1; page <= maxPages; page++) {
        const { data: events } = await octokit.activity.listEventsForAuthenticatedUser({
          username: user.login,
          per_page: 100,
          page
        });
        allEvents.push(...events as Activity[]);
      }

      setActivities(allEvents);
      setStats(calculateStats(allEvents));
      setLastUpdated(new Date());

      // Save token only (not the data to avoid localStorage issues)
      localStorage.setItem('github-tracker-token', tokenToUse);

    } catch (err: any) {
      if (err.status === 401) {
        setError('Invalid token. Please check your GitHub personal access token.');
      } else if (err.status === 403) {
        setError('Rate limit exceeded. Please wait before trying again.');
      } else {
        setError(`Error: ${err.message || 'Failed to fetch data'}`);
      }
    } finally {
      setLoading(false);
    }
  }, [calculateStats]);

  // Auto-refresh with safe interval
  useEffect(() => {
    if (!autoRefresh || !token || refreshInterval < 60000) return;

    const interval = setInterval(() => {
      // Only refresh if we have enough rate limit
      if (rateLimit && rateLimit.remaining > 20) {
        fetchActivities(token);
      }
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, token, refreshInterval, rateLimit, fetchActivities]);

  // Manual refresh
  const handleRefresh = () => {
    if (token) {
      fetchActivities(token);
    }
  };

  const handleTokenSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchActivities(token);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-center bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent">
          GitHub Activity Tracker
        </h1>

        {/* Token Input */}
        {!username && (
          <form onSubmit={handleTokenSubmit} className="mb-8">
            <div className="flex gap-4 max-w-2xl mx-auto">
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Enter GitHub Personal Access Token"
                className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                disabled={loading || !token}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 rounded-lg transition-colors"
              >
                {loading ? 'Loading...' : 'Connect'}
              </button>
            </div>
          </form>
        )}

        {/* Error Display */}
        {error && (
          <div className="mb-4 p-4 bg-red-900/50 border border-red-700 rounded-lg text-center">
            {error}
          </div>
        )}

        {/* User Info & Controls */}
        {username && (
          <div className="mb-8 p-4 bg-gray-800 rounded-lg">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-semibold">Connected as: {username}</h2>
                {lastUpdated && (
                  <p className="text-sm text-gray-400">
                    Last updated: {format(lastUpdated, 'MMM dd, yyyy HH:mm:ss')}
                  </p>
                )}
                {rateLimit && (
                  <p className="text-sm text-gray-400">
                    API Rate: {rateLimit.remaining}/{rateLimit.limit} (resets {format(rateLimit.reset, 'HH:mm')})
                  </p>
                )}
              </div>
              <div className="flex gap-4 items-center">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={autoRefresh}
                    onChange={(e) => setAutoRefresh(e.target.checked)}
                    className="rounded"
                  />
                  <span>Auto-refresh</span>
                </label>
                {autoRefresh && (
                  <select
                    value={refreshInterval}
                    onChange={(e) => setRefreshInterval(Number(e.target.value))}
                    className="px-3 py-1 bg-gray-700 rounded"
                  >
                    <option value={300000}>5 min</option>
                    <option value={600000}>10 min</option>
                    <option value={1800000}>30 min</option>
                  </select>
                )}
                <button
                  onClick={handleRefresh}
                  disabled={loading}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 rounded-lg transition-colors"
                >
                  Refresh
                </button>
                <button
                  onClick={() => {
                    setUsername('');
                    setActivities([]);
                    setStats(null);
                    setToken('');
                    localStorage.removeItem('github-tracker-token');
                  }}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                >
                  Disconnect
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Stats Display */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-gray-800 p-6 rounded-lg">
              <h3 className="text-sm text-gray-400 mb-2">Total Activities</h3>
              <p className="text-3xl font-bold">{stats.totalActivities}</p>
            </div>
            <div className="bg-gray-800 p-6 rounded-lg">
              <h3 className="text-sm text-gray-400 mb-2">Pull Requests</h3>
              <p className="text-3xl font-bold text-green-400">{stats.pullRequests}</p>
            </div>
            <div className="bg-gray-800 p-6 rounded-lg">
              <h3 className="text-sm text-gray-400 mb-2">Issues</h3>
              <p className="text-3xl font-bold text-yellow-400">{stats.issues}</p>
            </div>
            <div className="bg-gray-800 p-6 rounded-lg">
              <h3 className="text-sm text-gray-400 mb-2">Commits</h3>
              <p className="text-3xl font-bold text-blue-400">{stats.commits}</p>
            </div>
          </div>
        )}

        {/* Top Repositories */}
        {stats && stats.topRepos.length > 0 && (
          <div className="mb-8 bg-gray-800 p-6 rounded-lg">
            <h3 className="text-xl font-semibold mb-4">Top Repositories</h3>
            <div className="space-y-2">
              {stats.topRepos.map((repo) => (
                <div key={repo.name} className="flex justify-between items-center">
                  <span className="text-gray-300">{repo.name}</span>
                  <span className="text-gray-400">{repo.count} activities</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Activities */}
        {activities.length > 0 && (
          <div className="bg-gray-800 p-6 rounded-lg">
            <h3 className="text-xl font-semibold mb-4">Recent Activities</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {activities.slice(0, 20).map((activity) => (
                <div key={activity.id} className="p-3 bg-gray-700 rounded hover:bg-gray-600 transition-colors">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-sm font-medium text-blue-400">{activity.type.replace('Event', '')}</span>
                      <span className="text-sm text-gray-400 ml-2">in {activity.repo.name}</span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {format(new Date(activity.created_at), 'MMM dd, HH:mm')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;