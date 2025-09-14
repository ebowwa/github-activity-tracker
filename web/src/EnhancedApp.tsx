import { useState, useEffect } from 'react';
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

interface EnhancedStats {
  // Time-based metrics
  totalActivities: number;
  activitiesLast24h: number;
  activitiesLast7d: number;
  activitiesLast30d: number;
  
  // Activity breakdown
  pullRequests: { 
    opened: number; 
    closed: number; 
    merged: number; 
    reviewed: number;
    avgTimeToMerge?: number;
  };
  issues: { 
    opened: number; 
    closed: number; 
    commented: number;
    avgTimeToClose?: number;
  };
  commits: {
    total: number;
    filesChanged: number;
    additions: number;
    deletions: number;
  };
  
  // Repository metrics
  topRepos: { 
    name: string; 
    count: number; 
    commits: number;
    prs: number;
    issues: number;
    lastActivity: string;
  }[];
  totalReposActive: number;
  
  // Collaboration metrics
  collaborators: Map<string, number>;
  mentionsReceived: number;
  reviewsGiven: number;
  reviewsReceived: number;
  
  // Activity patterns
  hourlyDistribution: number[];
  dailyDistribution: number[];
  weeklyTrend: { date: string; count: number }[];
  
  // Language stats
  languageBreakdown: Map<string, number>;
  
  // Productivity metrics
  streakDays: number;
  mostProductiveDay: string;
  mostProductiveHour: number;
  avgDailyActivities: number;
}

interface FilterOptions {
  dateRange: 'today' | '7d' | '30d' | '90d' | 'all';
  activityTypes: string[];
  repositories: string[];
  searchQuery: string;
}

function EnhancedApp() {
  const [token, setToken] = useState('');
  const [activities, setActivities] = useState<Activity[]>([]);
  const [filteredActivities, setFilteredActivities] = useState<Activity[]>([]);
  const [stats, setStats] = useState<EnhancedStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [username, setUsername] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [filters, setFilters] = useState<FilterOptions>({
    dateRange: '7d',
    activityTypes: [],
    repositories: [],
    searchQuery: ''
  });
  const [viewMode, setViewMode] = useState<'grid' | 'timeline' | 'analytics'>('grid');
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Load persisted data on mount
  useEffect(() => {
    const savedData = localStorage.getItem('github-tracker-data');
    const savedFilters = localStorage.getItem('github-tracker-filters');
    const savedToken = localStorage.getItem('github-tracker-token');
    
    if (savedData) {
      const parsed = JSON.parse(savedData);
      setActivities(parsed.activities || []);
      setStats(parsed.stats || null);
      setUsername(parsed.username || '');
      setLastUpdated(parsed.lastUpdated ? new Date(parsed.lastUpdated) : null);
    }
    
    if (savedFilters) {
      setFilters(JSON.parse(savedFilters));
    }
    
    if (savedToken) {
      setToken(savedToken);
    }
    
    // Check for environment token
    const envToken = import.meta.env.VITE_GITHUB_TOKEN;
    if (envToken) {
      setToken(envToken);
      fetchActivities(envToken);
    }
  }, []);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh || !token) return;
    
    const interval = setInterval(() => {
      fetchActivities(token);
    }, 60000); // Refresh every minute
    
    return () => clearInterval(interval);
  }, [autoRefresh, token]);

  // Apply filters
  useEffect(() => {
    let filtered = [...activities];
    
    // Date range filter
    const now = new Date();
    let startDate: Date;
    
    switch (filters.dateRange) {
      case 'today':
        startDate = startOfDay(now);
        break;
      case '7d':
        startDate = subDays(now, 7);
        break;
      case '30d':
        startDate = subDays(now, 30);
        break;
      case '90d':
        startDate = subDays(now, 90);
        break;
      default:
        startDate = new Date(0);
    }
    
    filtered = filtered.filter(activity => 
      new Date(activity.created_at) >= startDate
    );
    
    // Activity type filter
    if (filters.activityTypes.length > 0) {
      filtered = filtered.filter(activity => 
        filters.activityTypes.includes(activity.type)
      );
    }
    
    // Repository filter
    if (filters.repositories.length > 0) {
      filtered = filtered.filter(activity => 
        filters.repositories.includes(activity.repo.name)
      );
    }
    
    // Search query
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(activity => {
        const description = getActivityDescription(activity).toLowerCase();
        const repoName = activity.repo.name.toLowerCase();
        return description.includes(query) || repoName.includes(query);
      });
    }
    
    setFilteredActivities(filtered);
  }, [activities, filters]);

  const fetchActivities = async (githubToken?: string) => {
    const tokenToUse = githubToken || token;
    if (!tokenToUse) {
      setError('Please enter a GitHub token');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const octokit = new Octokit({ auth: tokenToUse });
      const { data: user } = await octokit.users.getAuthenticated();
      const currentUsername = user.login;
      setUsername(currentUsername);

      // Fetch comprehensive data
      const [
        userEvents,
        receivedEvents,
        userRepos,
        followers,
        following,
        gists,
        starred
      ] = await Promise.all([
        octokit.activity.listEventsForAuthenticatedUser({ username: currentUsername, per_page: 100 }),
        octokit.activity.listReceivedEventsForUser({ username: currentUsername, per_page: 100 }),
        octokit.repos.listForAuthenticatedUser({ sort: 'pushed', per_page: 30 }),
        octokit.users.listFollowersForUser({ username: currentUsername, per_page: 100 }),
        octokit.users.listFollowingForUser({ username: currentUsername, per_page: 100 }),
        octokit.gists.listForUser({ username: currentUsername, per_page: 30 }),
        octokit.activity.listReposStarredByUser({ username: currentUsername, per_page: 50 })
      ]);
      
      // Fetch recent commits from active repos
      const recentCommitPromises = userRepos.data.slice(0, 10).map(repo => 
        octokit.repos.listCommits({ 
          owner: repo.owner.login, 
          repo: repo.name, 
          author: currentUsername,
          per_page: 10,
          since: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        }).catch(() => ({ data: [] }))
      );
      
      const recentCommitsResponses = await Promise.all(recentCommitPromises);
      
      // Fetch pull requests
      const prPromises = userRepos.data.slice(0, 5).map(repo =>
        octokit.pulls.list({
          owner: repo.owner.login,
          repo: repo.name,
          state: 'all',
          per_page: 10
        }).catch(() => ({ data: [] }))
      );
      
      const prResponses = await Promise.all(prPromises);
      
      // Convert recent commits to events
      const commitEvents: Activity[] = [];
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      
      recentCommitsResponses.forEach((response, index) => {
        const repo = userRepos.data[index];
        response.data.forEach(commit => {
          const commitDate = new Date(commit.commit.author?.date || '');
          if (commitDate > threeDaysAgo) {
            commitEvents.push({
              id: `commit-${commit.sha}`,
              type: 'PushEvent',
              created_at: commit.commit.author?.date || '',
              repo: { name: repo.full_name },
              actor: { login: currentUsername },
              payload: {
                commits: [{
                  sha: commit.sha,
                  message: commit.commit.message,
                  author: commit.commit.author,
                  stats: commit.stats
                }],
                size: 1
              }
            });
          }
        });
      });

      // Filter received events
      const filteredReceivedEvents = receivedEvents.data.filter(event => {
        if (event.actor.login === currentUsername) return true;
        if (event.repo.name.startsWith(currentUsername + '/')) return true;
        if (event.type === 'IssueCommentEvent' || event.type === 'PullRequestReviewCommentEvent') {
          const body = event.payload.comment?.body || '';
          return body.includes('@' + currentUsername);
        }
        if (event.type === 'PullRequestEvent' && event.payload.pull_request) {
          return event.payload.pull_request.user.login === currentUsername;
        }
        if (event.type === 'IssuesEvent' && event.payload.issue) {
          return event.payload.issue.user.login === currentUsername;
        }
        return false;
      });

      const allEvents = [...userEvents.data, ...filteredReceivedEvents, ...commitEvents];
      const uniqueEvents = Array.from(
        new Map(allEvents.map(e => [e.id, e])).values()
      ).sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      const finalActivities = uniqueEvents.slice(0, 200); // Keep more activities
      setActivities(finalActivities);
      
      // Calculate enhanced stats
      const enhancedStats = calculateEnhancedStats(finalActivities, userRepos.data, prResponses);
      setStats(enhancedStats);
      
      setLastUpdated(new Date());
      
      // Persist data
      const dataToSave = {
        activities: finalActivities,
        stats: enhancedStats,
        username: currentUsername,
        lastUpdated: new Date().toISOString()
      };
      localStorage.setItem('github-tracker-data', JSON.stringify(dataToSave));
      localStorage.setItem('github-tracker-token', tokenToUse);
      
    } catch (err: any) {
      setError(err.message || 'Failed to fetch activities');
    } finally {
      setLoading(false);
    }
  };

  const calculateEnhancedStats = (acts: Activity[], repos: any[], prResponses: any[]): EnhancedStats => {
    const now = new Date();
    const oneDayAgo = subDays(now, 1);
    const sevenDaysAgo = subDays(now, 7);
    const thirtyDaysAgo = subDays(now, 30);
    
    const stats: EnhancedStats = {
      totalActivities: acts.length,
      activitiesLast24h: 0,
      activitiesLast7d: 0,
      activitiesLast30d: 0,
      pullRequests: { opened: 0, closed: 0, merged: 0, reviewed: 0 },
      issues: { opened: 0, closed: 0, commented: 0 },
      commits: { total: 0, filesChanged: 0, additions: 0, deletions: 0 },
      topRepos: [],
      totalReposActive: 0,
      collaborators: new Map(),
      mentionsReceived: 0,
      reviewsGiven: 0,
      reviewsReceived: 0,
      hourlyDistribution: new Array(24).fill(0),
      dailyDistribution: new Array(7).fill(0),
      weeklyTrend: [],
      languageBreakdown: new Map(),
      streakDays: 0,
      mostProductiveDay: '',
      mostProductiveHour: 0,
      avgDailyActivities: 0
    };

    const repoStats: Record<string, any> = {};
    const dailyActivities: Record<string, number> = {};
    const uniqueRepos = new Set<string>();
    
    // Process each activity
    acts.forEach(activity => {
      const activityDate = new Date(activity.created_at);
      const hour = activityDate.getHours();
      const dayOfWeek = activityDate.getDay();
      const dateKey = format(activityDate, 'yyyy-MM-dd');
      
      // Time-based counting
      if (activityDate > oneDayAgo) stats.activitiesLast24h++;
      if (activityDate > sevenDaysAgo) stats.activitiesLast7d++;
      if (activityDate > thirtyDaysAgo) stats.activitiesLast30d++;
      
      // Hourly and daily distribution
      stats.hourlyDistribution[hour]++;
      stats.dailyDistribution[dayOfWeek]++;
      
      // Daily activities for streak calculation
      dailyActivities[dateKey] = (dailyActivities[dateKey] || 0) + 1;
      
      // Repository tracking
      uniqueRepos.add(activity.repo.name);
      if (!repoStats[activity.repo.name]) {
        repoStats[activity.repo.name] = {
          name: activity.repo.name,
          count: 0,
          commits: 0,
          prs: 0,
          issues: 0,
          lastActivity: activity.created_at
        };
      }
      repoStats[activity.repo.name].count++;
      
      // Activity type specific processing
      switch (activity.type) {
        case 'PullRequestEvent':
          repoStats[activity.repo.name].prs++;
          if (activity.payload.action === 'opened') stats.pullRequests.opened++;
          if (activity.payload.action === 'closed') {
            if (activity.payload.pull_request?.merged) {
              stats.pullRequests.merged++;
            } else {
              stats.pullRequests.closed++;
            }
          }
          break;
          
        case 'PullRequestReviewEvent':
          stats.pullRequests.reviewed++;
          stats.reviewsGiven++;
          break;
          
        case 'IssuesEvent':
          repoStats[activity.repo.name].issues++;
          if (activity.payload.action === 'opened') stats.issues.opened++;
          if (activity.payload.action === 'closed') stats.issues.closed++;
          break;
          
        case 'IssueCommentEvent':
          stats.issues.commented++;
          // Check for mentions
          const commentBody = activity.payload.comment?.body || '';
          if (commentBody.includes('@')) {
            stats.mentionsReceived++;
          }
          break;
          
        case 'PushEvent':
          const commitCount = activity.payload.commits?.length || 0;
          stats.commits.total += commitCount;
          repoStats[activity.repo.name].commits += commitCount;
          
          // If we have commit stats
          if (activity.payload.commits?.[0]?.stats) {
            stats.commits.additions += activity.payload.commits[0].stats.additions || 0;
            stats.commits.deletions += activity.payload.commits[0].stats.deletions || 0;
          }
          break;
          
        case 'PullRequestReviewCommentEvent':
          stats.reviewsReceived++;
          break;
      }
      
      // Track collaborators
      if (activity.actor.login !== username && activity.actor.login) {
        const count = stats.collaborators.get(activity.actor.login) || 0;
        stats.collaborators.set(activity.actor.login, count + 1);
      }
    });
    
    // Calculate streak
    const sortedDates = Object.keys(dailyActivities).sort().reverse();
    let currentStreak = 0;
    const today = format(now, 'yyyy-MM-dd');
    
    for (let i = 0; i < sortedDates.length; i++) {
      const checkDate = format(subDays(now, i), 'yyyy-MM-dd');
      if (dailyActivities[checkDate]) {
        currentStreak++;
      } else if (i > 0) { // Allow for today to be empty
        break;
      }
    }
    stats.streakDays = currentStreak;
    
    // Find most productive day and hour
    let maxDailyCount = 0;
    let mostProductiveDate = '';
    for (const [date, count] of Object.entries(dailyActivities)) {
      if (count > maxDailyCount) {
        maxDailyCount = count;
        mostProductiveDate = date;
      }
    }
    stats.mostProductiveDay = mostProductiveDate;
    
    const maxHourlyCount = Math.max(...stats.hourlyDistribution);
    stats.mostProductiveHour = stats.hourlyDistribution.indexOf(maxHourlyCount);
    
    // Calculate average daily activities
    const daysWithActivity = Object.keys(dailyActivities).length;
    stats.avgDailyActivities = daysWithActivity > 0 
      ? Math.round(stats.totalActivities / daysWithActivity) 
      : 0;
    
    // Weekly trend (last 7 days)
    for (let i = 6; i >= 0; i--) {
      const date = format(subDays(now, i), 'yyyy-MM-dd');
      stats.weeklyTrend.push({
        date,
        count: dailyActivities[date] || 0
      });
    }
    
    // Top repositories
    stats.topRepos = Object.values(repoStats)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    stats.totalReposActive = uniqueRepos.size;
    
    // Language breakdown from repos
    repos.forEach(repo => {
      if (repo.language) {
        const count = stats.languageBreakdown.get(repo.language) || 0;
        stats.languageBreakdown.set(repo.language, count + 1);
      }
    });
    
    return stats;
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'PushEvent': return '🚀';
      case 'PullRequestEvent': return '🔀';
      case 'IssuesEvent': return '📝';
      case 'IssueCommentEvent': return '💬';
      case 'WatchEvent': return '⭐';
      case 'ForkEvent': return '🍴';
      case 'CreateEvent': return '✨';
      case 'DeleteEvent': return '🗑️';
      case 'ReleaseEvent': return '🎉';
      case 'PullRequestReviewEvent': return '👀';
      case 'PullRequestReviewCommentEvent': return '💭';
      case 'GollumEvent': return '📚';
      case 'PublicEvent': return '🌍';
      default: return '📌';
    }
  };

  const getActivityDescription = (activity: Activity) => {
    const actor = activity.actor.login;
    const repo = activity.repo.name;
    
    switch (activity.type) {
      case 'PushEvent':
        const commitCount = activity.payload.commits?.length || activity.payload.size || 0;
        const branch = activity.payload.ref?.replace('refs/heads/', '') || 'main';
        return `${actor} pushed ${commitCount} commit${commitCount !== 1 ? 's' : ''} to ${branch} in ${repo}`;
      case 'PullRequestEvent':
        return `${actor} ${activity.payload.action} PR #${activity.payload.number} in ${repo}`;
      case 'IssuesEvent':
        return `${actor} ${activity.payload.action} issue #${activity.payload.issue?.number} in ${repo}`;
      case 'IssueCommentEvent':
        return `${actor} commented on issue #${activity.payload.issue?.number} in ${repo}`;
      case 'WatchEvent':
        return `${actor} starred ${repo}`;
      case 'ForkEvent':
        return `${actor} forked ${repo}`;
      case 'CreateEvent':
        return `${actor} created ${activity.payload.ref_type} ${activity.payload.ref || ''} in ${repo}`;
      case 'DeleteEvent':
        return `${actor} deleted ${activity.payload.ref_type} ${activity.payload.ref || ''} in ${repo}`;
      case 'ReleaseEvent':
        return `${actor} ${activity.payload.action} release ${activity.payload.release?.tag_name} in ${repo}`;
      case 'PullRequestReviewEvent':
        return `${actor} reviewed PR #${activity.payload.pull_request?.number} in ${repo}`;
      case 'PullRequestReviewCommentEvent':
        return `${actor} commented on PR review in ${repo}`;
      case 'GollumEvent':
        return `${actor} ${activity.payload.pages?.[0]?.action || 'updated'} wiki in ${repo}`;
      case 'PublicEvent':
        return `${actor} made ${repo} public`;
      default:
        return `${actor} performed ${activity.type.replace('Event', '')} on ${repo}`;
    }
  };

  const exportData = () => {
    const dataStr = JSON.stringify({
      activities: filteredActivities,
      stats,
      filters,
      exportDate: new Date().toISOString()
    }, null, 2);
    
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `github-activity-${format(new Date(), 'yyyy-MM-dd')}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">GitHub Activity Dashboard</h1>
              {username && (
                <p className="text-lg text-gray-600 mt-2">
                  @{username} • {stats?.totalReposActive} active repos • {stats?.streakDays} day streak 🔥
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-4 py-2 rounded-lg ${viewMode === 'grid' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
              >
                📊 Grid
              </button>
              <button
                onClick={() => setViewMode('timeline')}
                className={`px-4 py-2 rounded-lg ${viewMode === 'timeline' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
              >
                📈 Timeline
              </button>
              <button
                onClick={() => setViewMode('analytics')}
                className={`px-4 py-2 rounded-lg ${viewMode === 'analytics' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
              >
                📉 Analytics
              </button>
            </div>
          </div>
          
          {/* Controls */}
          <div className="flex gap-4 items-center">
            {!import.meta.env.VITE_GITHUB_TOKEN && (
              <input
                type="password"
                placeholder="GitHub Token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
              />
            )}
            <button
              onClick={() => fetchActivities()}
              disabled={loading}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400"
            >
              {loading ? 'Loading...' : '🔄 Refresh'}
            </button>
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-4 py-2 rounded-lg ${autoRefresh ? 'bg-green-500 text-white' : 'bg-gray-200'}`}
            >
              {autoRefresh ? '⏸ Auto' : '▶️ Auto'}
            </button>
            <button
              onClick={exportData}
              className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600"
            >
              📥 Export
            </button>
            {lastUpdated && (
              <span className="text-sm text-gray-500">
                Updated: {format(lastUpdated, 'HH:mm:ss')}
              </span>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex gap-4 items-center">
            <select
              value={filters.dateRange}
              onChange={(e) => setFilters({...filters, dateRange: e.target.value as any})}
              className="px-4 py-2 border border-gray-300 rounded-lg"
            >
              <option value="today">Today</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
              <option value="all">All Time</option>
            </select>
            
            <input
              type="text"
              placeholder="Search activities..."
              value={filters.searchQuery}
              onChange={(e) => setFilters({...filters, searchQuery: e.target.value})}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
            />
            
            <div className="text-sm text-gray-600">
              Showing {filteredActivities.length} of {activities.length} activities
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {/* Main Content */}
        {viewMode === 'grid' && stats && (
          <>
            {/* Key Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-sm font-semibold text-gray-600 mb-2">24h Activity</h3>
                <p className="text-3xl font-bold text-blue-600">{stats.activitiesLast24h}</p>
                <p className="text-xs text-gray-500 mt-2">
                  {stats.avgDailyActivities} daily avg
                </p>
              </div>
              
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-sm font-semibold text-gray-600 mb-2">Pull Requests</h3>
                <div className="space-y-1">
                  <p className="text-sm">
                    <span className="text-green-600 font-bold">{stats.pullRequests.merged}</span> merged
                  </p>
                  <p className="text-sm">
                    <span className="text-yellow-600 font-bold">{stats.pullRequests.opened}</span> opened
                  </p>
                  <p className="text-sm">
                    <span className="text-purple-600 font-bold">{stats.pullRequests.reviewed}</span> reviewed
                  </p>
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-sm font-semibold text-gray-600 mb-2">Commits</h3>
                <p className="text-3xl font-bold text-purple-600">{stats.commits.total}</p>
                <div className="text-xs text-gray-500 mt-2">
                  <span className="text-green-600">+{stats.commits.additions}</span> / 
                  <span className="text-red-600">-{stats.commits.deletions}</span>
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-sm font-semibold text-gray-600 mb-2">Issues</h3>
                <div className="space-y-1">
                  <p className="text-sm">
                    <span className="text-green-600 font-bold">{stats.issues.closed}</span> closed
                  </p>
                  <p className="text-sm">
                    <span className="text-yellow-600 font-bold">{stats.issues.opened}</span> opened
                  </p>
                  <p className="text-sm">
                    <span className="text-blue-600 font-bold">{stats.issues.commented}</span> comments
                  </p>
                </div>
              </div>
            </div>

            {/* Repository Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold text-gray-700 mb-4">Top Repositories</h3>
                <div className="space-y-3">
                  {stats.topRepos.map((repo) => (
                    <div key={repo.name} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                      <div className="flex-1">
                        <div className="font-medium text-sm">{repo.name}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          {repo.commits} commits • {repo.prs} PRs • {repo.issues} issues
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-blue-600">{repo.count}</div>
                        <div className="text-xs text-gray-500">activities</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold text-gray-700 mb-4">Language Distribution</h3>
                <div className="space-y-2">
                  {Array.from(stats.languageBreakdown.entries())
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 8)
                    .map(([lang, count]) => (
                      <div key={lang} className="flex justify-between items-center">
                        <span className="text-sm font-medium">{lang}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-32 bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-blue-500 h-2 rounded-full"
                              style={{ 
                                width: `${(count / Math.max(...stats.languageBreakdown.values())) * 100}%` 
                              }}
                            />
                          </div>
                          <span className="text-sm text-gray-600">{count}</span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            {/* Activity Patterns */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-700 mb-4">Activity Patterns</h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-sm font-medium text-gray-600 mb-3">Hourly Distribution</h4>
                  <div className="flex items-end gap-1 h-32">
                    {stats.hourlyDistribution.map((count, hour) => (
                      <div key={hour} className="flex-1 flex flex-col items-center">
                        <div 
                          className="w-full bg-blue-500 rounded-t"
                          style={{ 
                            height: `${(count / Math.max(...stats.hourlyDistribution)) * 100}%`,
                            minHeight: count > 0 ? '2px' : '0'
                          }}
                          title={`${hour}:00 - ${count} activities`}
                        />
                        {hour % 6 === 0 && (
                          <span className="text-xs text-gray-500 mt-1">{hour}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium text-gray-600 mb-3">Weekly Trend</h4>
                  <div className="flex items-end gap-2 h-32">
                    {stats.weeklyTrend.map((day) => (
                      <div key={day.date} className="flex-1 flex flex-col items-center">
                        <div 
                          className="w-full bg-green-500 rounded-t"
                          style={{ 
                            height: `${day.count > 0 ? (day.count / Math.max(...stats.weeklyTrend.map(d => d.count))) * 100 : 0}%`,
                            minHeight: day.count > 0 ? '2px' : '0'
                          }}
                          title={`${day.date}: ${day.count} activities`}
                        />
                        <span className="text-xs text-gray-500 mt-1">
                          {format(new Date(day.date), 'EEE')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Collaboration */}
            {stats.collaborators.size > 0 && (
              <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-700 mb-4">
                  Top Collaborators
                </h3>
                <div className="flex flex-wrap gap-2">
                  {Array.from(stats.collaborators.entries())
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 20)
                    .map(([user, count]) => (
                      <div key={user} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                        @{user} ({count})
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Recent Activities */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-700 mb-4">Recent Activities</h3>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {filteredActivities.slice(0, 50).map((activity) => (
                  <div key={activity.id} className="flex items-start space-x-3 p-3 hover:bg-gray-50 rounded">
                    <span className="text-2xl">{getActivityIcon(activity.type)}</span>
                    <div className="flex-1">
                      <p className="text-sm text-gray-700">{getActivityDescription(activity)}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {format(new Date(activity.created_at), 'MMM dd, HH:mm')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {viewMode === 'timeline' && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-700 mb-4">Activity Timeline</h3>
            <div className="relative">
              <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-300"></div>
              {filteredActivities.slice(0, 100).map((activity, index) => (
                <div key={activity.id} className="relative flex items-start mb-6">
                  <div className="absolute left-6 w-4 h-4 bg-blue-500 rounded-full border-2 border-white"></div>
                  <div className="ml-14 flex-1">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <span className="text-2xl">{getActivityIcon(activity.type)}</span>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-700">
                            {getActivityDescription(activity)}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {format(new Date(activity.created_at), 'MMM dd, yyyy HH:mm:ss')}
                          </p>
                          {activity.payload.commits && activity.payload.commits[0]?.message && (
                            <p className="text-xs text-gray-600 mt-2 font-mono bg-gray-100 p-2 rounded">
                              {activity.payload.commits[0].message}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {viewMode === 'analytics' && stats && (
          <div className="space-y-6">
            {/* Productivity Insights */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-700 mb-4">Productivity Insights</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-4xl mb-2">🏆</div>
                  <p className="text-sm text-gray-600">Most Productive Hour</p>
                  <p className="text-2xl font-bold text-blue-600">{stats.mostProductiveHour}:00</p>
                </div>
                <div className="text-center">
                  <div className="text-4xl mb-2">📅</div>
                  <p className="text-sm text-gray-600">Most Active Day</p>
                  <p className="text-xl font-bold text-green-600">
                    {stats.mostProductiveDay && format(new Date(stats.mostProductiveDay), 'MMM dd, yyyy')}
                  </p>
                </div>
                <div className="text-center">
                  <div className="text-4xl mb-2">⚡</div>
                  <p className="text-sm text-gray-600">Daily Average</p>
                  <p className="text-2xl font-bold text-purple-600">{stats.avgDailyActivities} activities</p>
                </div>
              </div>
            </div>

            {/* Activity Breakdown */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-700 mb-4">Activity Type Distribution</h3>
              <div className="space-y-3">
                {Object.entries(
                  filteredActivities.reduce((acc, act) => {
                    acc[act.type] = (acc[act.type] || 0) + 1;
                    return acc;
                  }, {} as Record<string, number>)
                )
                  .sort((a, b) => b[1] - a[1])
                  .map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{getActivityIcon(type)}</span>
                        <span className="text-sm font-medium">{type.replace('Event', '')}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-48 bg-gray-200 rounded-full h-3">
                          <div 
                            className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full"
                            style={{ width: `${(count / filteredActivities.length) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm font-bold text-gray-700 w-12 text-right">{count}</span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Contribution Matrix */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-700 mb-4">Day of Week Analysis</h3>
              <div className="grid grid-cols-7 gap-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                  <div key={day} className="text-center">
                    <p className="text-xs text-gray-600 mb-2">{day}</p>
                    <div className="relative">
                      <div className="w-full h-20 bg-gray-100 rounded flex items-end justify-center">
                        <div 
                          className="w-full bg-gradient-to-t from-green-500 to-green-300 rounded"
                          style={{ 
                            height: `${(stats.dailyDistribution[index] / Math.max(...stats.dailyDistribution)) * 100}%`,
                            minHeight: stats.dailyDistribution[index] > 0 ? '4px' : '0'
                          }}
                        />
                      </div>
                      <p className="text-xs font-bold mt-1">{stats.dailyDistribution[index]}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default EnhancedApp;