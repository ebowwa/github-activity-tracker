import { useState, useEffect } from 'react';
import { Octokit } from '@octokit/rest';
import { format } from 'date-fns';

interface Activity {
  id: string;
  type: string;
  created_at: string;
  repo: { name: string };
  payload: any;
  actor: { login: string };
}

interface Stats {
  totalActivities: number;
  pullRequests: { opened: number; closed: number; merged: number };
  issues: { opened: number; closed: number; commented: number };
  commits: number;
  topRepos: { name: string; count: number }[];
}

function App() {
  const [token, setToken] = useState('');
  const [activities, setActivities] = useState<Activity[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [username, setUsername] = useState('');

  useEffect(() => {
    // Check if running on Vercel with environment variables
    const envToken = import.meta.env.VITE_GITHUB_TOKEN;
    if (envToken) {
      setToken(envToken);
      fetchActivities(envToken);
    }
  }, []);

  const fetchActivities = async (githubToken?: string) => {
    const tokenToUse = githubToken || token;
    if (!tokenToUse) {
      setError('Please enter a GitHub token');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // If on Vercel, use the API route
      if (import.meta.env.PROD) {
        const response = await fetch('/api/github-activities', {
          headers: {
            'Authorization': `Bearer ${tokenToUse}`
          }
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setActivities(data.activities);
        setUsername(data.username);
      } else {
        // Local development - direct API calls
        const octokit = new Octokit({ auth: tokenToUse });
        const { data: user } = await octokit.users.getAuthenticated();
        const currentUsername = user.login;
        setUsername(currentUsername);

        const [userEvents, receivedEvents] = await Promise.all([
          octokit.activity.listPublicEventsForUser({ username: currentUsername, per_page: 100 }),
          octokit.activity.listReceivedEventsForUser({ username: currentUsername, per_page: 100 })
        ]);

        // Filter received events to only include those that involve the current user
        const filteredReceivedEvents = receivedEvents.data.filter(event => {
          // Keep events where the current user is the actor
          if (event.actor.login === currentUsername) return true;
          
          // Keep events on repos owned by the current user
          if (event.repo.name.startsWith(currentUsername + '/')) return true;
          
          // Keep issue/PR comment events where the user might be mentioned
          if (event.type === 'IssueCommentEvent' || event.type === 'PullRequestReviewCommentEvent') {
            const body = event.payload.comment?.body || '';
            return body.includes('@' + currentUsername);
          }
          
          // Keep PR events where the user is the PR author
          if (event.type === 'PullRequestEvent' && event.payload.pull_request) {
            return event.payload.pull_request.user.login === currentUsername;
          }
          
          // Keep issue events where the user is the issue author
          if (event.type === 'IssuesEvent' && event.payload.issue) {
            return event.payload.issue.user.login === currentUsername;
          }
          
          // Filter out other people's Fork, Watch, Star events
          if (event.type === 'ForkEvent' || event.type === 'WatchEvent') {
            return false;
          }
          
          return false;
        });

        const allEvents = [...userEvents.data, ...filteredReceivedEvents];
        const uniqueEvents = Array.from(
          new Map(allEvents.map(e => [e.id, e])).values()
        ).sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        setActivities(uniqueEvents.slice(0, 100));
      }

      // Calculate stats
      calculateStats(activities);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch activities');
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (acts: Activity[]) => {
    const stats: Stats = {
      totalActivities: acts.length,
      pullRequests: { opened: 0, closed: 0, merged: 0 },
      issues: { opened: 0, closed: 0, commented: 0 },
      commits: 0,
      topRepos: []
    };

    const repoCount: Record<string, number> = {};

    acts.forEach(activity => {
      // Count repo activity
      repoCount[activity.repo.name] = (repoCount[activity.repo.name] || 0) + 1;

      // Count activity types
      switch (activity.type) {
        case 'PullRequestEvent':
          if (activity.payload.action === 'opened') stats.pullRequests.opened++;
          if (activity.payload.action === 'closed') {
            if (activity.payload.pull_request?.merged) {
              stats.pullRequests.merged++;
            } else {
              stats.pullRequests.closed++;
            }
          }
          break;
        case 'IssuesEvent':
          if (activity.payload.action === 'opened') stats.issues.opened++;
          if (activity.payload.action === 'closed') stats.issues.closed++;
          break;
        case 'IssueCommentEvent':
          stats.issues.commented++;
          break;
        case 'PushEvent':
          stats.commits += activity.payload.commits?.length || 0;
          break;
      }
    });

    // Get top 5 repos
    stats.topRepos = Object.entries(repoCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    setStats(stats);
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
      default: return '📌';
    }
  };

  const getActivityDescription = (activity: Activity) => {
    const actor = activity.actor.login;
    const repo = activity.repo.name;
    
    switch (activity.type) {
      case 'PushEvent':
        const commitCount = activity.payload.commits?.length || 0;
        return `${actor} pushed ${commitCount} commit${commitCount !== 1 ? 's' : ''} to ${repo}`;
      case 'PullRequestEvent':
        return `${actor} ${activity.payload.action} a pull request in ${repo}`;
      case 'IssuesEvent':
        return `${actor} ${activity.payload.action} an issue in ${repo}`;
      case 'IssueCommentEvent':
        return `${actor} commented on an issue in ${repo}`;
      case 'WatchEvent':
        return `${actor} starred ${repo}`;
      case 'ForkEvent':
        return `${actor} forked ${repo}`;
      case 'CreateEvent':
        return `${actor} created ${activity.payload.ref_type} in ${repo}`;
      case 'DeleteEvent':
        return `${actor} deleted ${activity.payload.ref_type} in ${repo}`;
      case 'ReleaseEvent':
        return `${actor} ${activity.payload.action} a release in ${repo}`;
      case 'PullRequestReviewEvent':
        return `${actor} reviewed a pull request in ${repo}`;
      case 'PullRequestReviewCommentEvent':
        return `${actor} commented on a pull request review in ${repo}`;
      default:
        return `${actor} performed ${activity.type.replace('Event', '')} on ${repo}`;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="container mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">GitHub Activity Tracker</h1>
        
        {!import.meta.env.VITE_GITHUB_TOKEN && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <div className="flex gap-4">
              <input
                type="password"
                placeholder="Enter GitHub Token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={() => fetchActivities()}
                disabled={loading}
                className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400"
              >
                {loading ? 'Loading...' : 'Fetch Activities'}
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-8">
            {error}
          </div>
        )}

        {username && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-700 mb-2">
              Activities for: <span className="text-blue-600">@{username}</span>
            </h2>
            <p className="text-gray-500">Showing your personal GitHub activities (excluding other people's stars/forks)</p>
          </div>
        )}

        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-700 mb-2">Total Activities</h3>
              <p className="text-3xl font-bold text-blue-600">{stats.totalActivities}</p>
            </div>
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-700 mb-2">Pull Requests</h3>
              <div className="space-y-1">
                <p className="text-sm">Opened: <span className="font-bold">{stats.pullRequests.opened}</span></p>
                <p className="text-sm">Merged: <span className="font-bold text-green-600">{stats.pullRequests.merged}</span></p>
                <p className="text-sm">Closed: <span className="font-bold">{stats.pullRequests.closed}</span></p>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-700 mb-2">Issues</h3>
              <div className="space-y-1">
                <p className="text-sm">Opened: <span className="font-bold">{stats.issues.opened}</span></p>
                <p className="text-sm">Closed: <span className="font-bold">{stats.issues.closed}</span></p>
                <p className="text-sm">Comments: <span className="font-bold">{stats.issues.commented}</span></p>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-700 mb-2">Commits</h3>
              <p className="text-3xl font-bold text-purple-600">{stats.commits}</p>
            </div>
          </div>
        )}

        {stats && stats.topRepos.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h3 className="text-lg font-semibold text-gray-700 mb-4">Top Repositories</h3>
            <div className="space-y-2">
              {stats.topRepos.map((repo) => (
                <div key={repo.name} className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-600">{repo.name}</span>
                  <span className="text-sm font-bold text-blue-600">{repo.count} activities</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-4">Recent Activities</h3>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {activities.map((activity) => (
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
      </div>
    </div>
  );
}

export default App;