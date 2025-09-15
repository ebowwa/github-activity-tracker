import { useState, useEffect } from 'react';
import {
  useGitHubData,
  GitHubStatsCard,
  ActivityFeed,
  RateLimitBadge,
  type FilterOptions
} from '../web/src/lib';
import { format } from 'date-fns';

/**
 * Main App using the composable GitHub Activity Tracker library
 */
function App() {
  const [token, setToken] = useState('');
  const [inputToken, setInputToken] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(300000);

  const {
    activities,
    stats,
    rateLimit,
    lastUpdated,
    loading,
    error,
    fetchActivities,
    setFilters,
  } = useGitHubData({
    config: {
      token,
      autoRefresh,
      refreshInterval,
      maxPages: 3,
      cacheEnabled: true,
      cacheDuration: 300000,
    },
    onError: (err) => {
      console.error('GitHub API Error:', err);
    },
    onRateLimitWarning: (info) => {
      console.warn('Rate limit warning:', info);
    },
  });

  // Load saved token on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('github-tracker-token');
    if (savedToken) {
      setToken(savedToken);
      setInputToken(savedToken);
    }
  }, []);

  // Fetch data when token is set
  useEffect(() => {
    if (token) {
      fetchActivities();
    }
  }, [token]);

  const handleTokenSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputToken) {
      setToken(inputToken);
      localStorage.setItem('github-tracker-token', inputToken);
    }
  };

  const handleDisconnect = () => {
    setToken('');
    setInputToken('');
    localStorage.removeItem('github-tracker-token');
  };

  const handleFilterChange = (newFilters: FilterOptions) => {
    setFilters(newFilters);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-center bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent">
            GitHub Activity Tracker
          </h1>
        </div>

        {/* Token Input */}
        {!token && (
          <form onSubmit={handleTokenSubmit} className="mb-8">
            <div className="flex gap-4 max-w-2xl mx-auto">
              <input
                type="password"
                value={inputToken}
                onChange={(e) => setInputToken(e.target.value)}
                placeholder="Enter GitHub Personal Access Token"
                className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                disabled={loading || !inputToken}
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

        {/* Connected View */}
        {token && (
          <>
            {/* Controls Bar */}
            <div className="mb-8 p-4 bg-gray-800 rounded-lg">
              <div className="flex justify-between items-center flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  {lastUpdated && (
                    <p className="text-sm text-gray-400">
                      Last updated: {format(lastUpdated, 'MMM dd, yyyy HH:mm:ss')}
                    </p>
                  )}
                  <RateLimitBadge rateLimit={rateLimit} variant="compact" />
                </div>

                <div className="flex gap-4 items-center">
                  {/* Auto-refresh toggle */}
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={autoRefresh}
                      onChange={(e) => setAutoRefresh(e.target.checked)}
                      className="rounded"
                    />
                    <span>Auto-refresh</span>
                  </label>

                  {/* Refresh interval selector */}
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

                  {/* Manual refresh */}
                  <button
                    onClick={() => fetchActivities()}
                    disabled={loading}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 rounded-lg transition-colors"
                  >
                    Refresh
                  </button>

                  {/* Disconnect */}
                  <button
                    onClick={handleDisconnect}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                  >
                    Disconnect
                  </button>
                </div>
              </div>
            </div>

            {/* Filter Controls */}
            <div className="mb-8 p-4 bg-gray-800 rounded-lg">
              <h3 className="text-lg font-semibold mb-3">Filters</h3>
              <div className="flex gap-4 flex-wrap">
                <select
                  onChange={(e) => handleFilterChange({ dateRange: e.target.value as any })}
                  className="px-3 py-2 bg-gray-700 rounded"
                >
                  <option value="all">All Time</option>
                  <option value="today">Today</option>
                  <option value="7d">Last 7 Days</option>
                  <option value="30d">Last 30 Days</option>
                  <option value="90d">Last 90 Days</option>
                </select>

                <input
                  type="text"
                  placeholder="Search activities..."
                  onChange={(e) => handleFilterChange({ searchQuery: e.target.value })}
                  className="px-3 py-2 bg-gray-700 rounded flex-1 min-w-[200px]"
                />
              </div>
            </div>

            {/* Rate Limit Full Display */}
            <div className="mb-8">
              <RateLimitBadge rateLimit={rateLimit} variant="full" />
            </div>

            {/* Stats Grid */}
            {stats && (
              <div className="mb-8">
                <GitHubStatsCard stats={stats} variant="dark" />
              </div>
            )}

            {/* Top Repositories */}
            {stats && stats.topRepos.length > 0 && (
              <div className="mb-8 bg-gray-800 p-6 rounded-lg">
                <h3 className="text-xl font-semibold mb-4">Top Repositories</h3>
                <div className="space-y-2">
                  {stats.topRepos.slice(0, 5).map((repo) => (
                    <div key={repo.name} className="flex justify-between items-center">
                      <span className="text-gray-300">{repo.name}</span>
                      <div className="flex gap-4 text-sm text-gray-400">
                        {repo.commits && <span>{repo.commits} commits</span>}
                        {repo.prs && <span>{repo.prs} PRs</span>}
                        {repo.issues && <span>{repo.issues} issues</span>}
                        <span className="font-semibold">{repo.count} total</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Activity Feed */}
            {activities.length > 0 && (
              <ActivityFeed
                activities={activities}
                maxItems={20}
                variant="dark"
                onActivityClick={(activity) => {
                  console.log('Activity clicked:', activity);
                }}
              />
            )}

            {/* Loading State */}
            {loading && (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                <p className="mt-2 text-gray-400">Loading activities...</p>
              </div>
            )}

            {/* Empty State */}
            {!loading && activities.length === 0 && (
              <div className="text-center py-8 text-gray-400">
                No activities found. Try adjusting your filters.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default App;