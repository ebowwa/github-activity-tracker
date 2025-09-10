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
        setUsername(user.login);

        const [userEvents, receivedEvents] = await Promise.all([
          octokit.activity.listPublicEventsForUser({ username: user.login, per_page: 100 }),
          octokit.activity.listReceivedEventsForUser({ username: user.login, per_page: 100 })
        ]);

        const allEvents = [...userEvents.data, ...receivedEvents.data];
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
      // Count by repo
      repoCount[activity.repo.name] = (repoCount[activity.repo.name] || 0) + 1;

      // Count by type
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

    stats.topRepos = Object.entries(repoCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    setStats(stats);
  };

  const getActivityDescription = (activity: Activity) => {
    switch (activity.type) {
      case 'PushEvent':
        return `Pushed ${activity.payload.commits?.length || 0} commit(s) to ${activity.payload.ref?.replace('refs/heads/', '')}`;
      case 'PullRequestEvent':
        return `${activity.payload.action} PR #${activity.payload.pull_request?.number}: ${activity.payload.pull_request?.title}`;
      case 'IssuesEvent':
        return `${activity.payload.action} issue #${activity.payload.issue?.number}: ${activity.payload.issue?.title}`;
      case 'IssueCommentEvent':
        return `Commented on issue #${activity.payload.issue?.number}`;
      case 'CreateEvent':
        return `Created ${activity.payload.ref_type} ${activity.payload.ref || ''}`;
      case 'WatchEvent':
        return 'Starred repository';
      case 'ForkEvent':
        return 'Forked repository';
      default:
        return activity.type.replace('Event', '');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-center mb-8 text-gray-800 dark:text-white">
          GitHub Activity Tracker
        </h1>

        {!import.meta.env.VITE_GITHUB_TOKEN && (
          <div className="max-w-md mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8">
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                GitHub Token
              </label>
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>
            <button
              onClick={() => fetchActivities()}
              disabled={loading}
              className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 disabled:bg-gray-400"
            >
              {loading ? 'Loading...' : 'Fetch Activities'}
            </button>
          </div>
        )}

        {error && (
          <div className="max-w-md mx-auto mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        {username && (
          <div className="text-center mb-4">
            <span className="text-lg font-semibold text-gray-700 dark:text-gray-300">
              Activities for: <span className="text-blue-500">{username}</span>
            </span>
          </div>
        )}

        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
              <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">Pull Requests</h3>
              <div className="space-y-1 text-sm">
                <div>Opened: <span className="font-bold text-green-500">{stats.pullRequests.opened}</span></div>
                <div>Merged: <span className="font-bold text-blue-500">{stats.pullRequests.merged}</span></div>
                <div>Closed: <span className="font-bold text-red-500">{stats.pullRequests.closed}</span></div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
              <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">Issues</h3>
              <div className="space-y-1 text-sm">
                <div>Opened: <span className="font-bold text-green-500">{stats.issues.opened}</span></div>
                <div>Closed: <span className="font-bold text-red-500">{stats.issues.closed}</span></div>
                <div>Comments: <span className="font-bold text-blue-500">{stats.issues.commented}</span></div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
              <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">Activity Summary</h3>
              <div className="space-y-1 text-sm">
                <div>Total: <span className="font-bold text-purple-500">{stats.totalActivities}</span></div>
                <div>Commits: <span className="font-bold text-green-500">{stats.commits}</span></div>
                <div>Top Repo: <span className="font-bold text-blue-500">{stats.topRepos[0]?.name.split('/')[1] || 'N/A'}</span></div>
              </div>
            </div>
          </div>
        )}

        {activities.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
            <table className="min-w-full">
              <thead className="bg-gray-100 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Repository
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Description
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {activities.slice(0, 50).map((activity) => (
                  <tr key={activity.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                      {format(new Date(activity.created_at), 'MMM dd HH:mm')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                        {activity.type.replace('Event', '')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                      {activity.repo.name}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-300">
                      {getActivityDescription(activity)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;