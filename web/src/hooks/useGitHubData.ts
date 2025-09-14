import { useState, useEffect, useCallback } from 'react';
import { Octokit } from '@octokit/rest';
import { Activity, EnhancedStats, Repository, UserProfile } from '../types';
import { calculateEnhancedStats } from '../utils/statsCalculator';

interface UseGitHubDataReturn {
  activities: Activity[];
  stats: EnhancedStats | null;
  repos: Repository[];
  userProfile: UserProfile | null;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  fetchData: (token?: string) => Promise<void>;
  clearError: () => void;
}

export const useGitHubData = (token?: string): UseGitHubDataReturn => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [stats, setStats] = useState<EnhancedStats | null>(null);
  const [repos, setRepos] = useState<Repository[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = useCallback(async (githubToken?: string) => {
    const tokenToUse = githubToken || token;
    if (!tokenToUse) {
      setError('GitHub token is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const octokit = new Octokit({ auth: tokenToUse });
      
      // Fetch user profile
      const { data: user } = await octokit.users.getAuthenticated();
      setUserProfile(user as UserProfile);
      
      const currentUsername = user.login;

      // Fetch comprehensive data in parallel
      const [
        userEvents,
        receivedEvents,
        userRepos,
        followers,
        following,
        gists,
        starred,
        notifications,
        userOrgs
      ] = await Promise.all([
        octokit.activity.listEventsForAuthenticatedUser({ 
          username: currentUsername, 
          per_page: 100 
        }),
        octokit.activity.listReceivedEventsForUser({ 
          username: currentUsername, 
          per_page: 100 
        }),
        octokit.repos.listForAuthenticatedUser({ 
          sort: 'pushed', 
          per_page: 50,
          type: 'all'
        }),
        octokit.users.listFollowersForUser({ 
          username: currentUsername, 
          per_page: 100 
        }),
        octokit.users.listFollowingForUser({ 
          username: currentUsername, 
          per_page: 100 
        }),
        octokit.gists.listForUser({ 
          username: currentUsername, 
          per_page: 30 
        }),
        octokit.activity.listReposStarredByUser({ 
          username: currentUsername, 
          per_page: 50 
        }),
        octokit.activity.listNotificationsForAuthenticatedUser({
          all: false,
          participating: true,
          per_page: 50
        }).catch(() => ({ data: [] })),
        octokit.orgs.listForAuthenticatedUser({
          per_page: 30
        }).catch(() => ({ data: [] }))
      ]);
      
      // Store repos for later use
      setRepos(userRepos.data as Repository[]);
      
      // Fetch recent commits from active repos
      const recentCommitPromises = userRepos.data.slice(0, 15).map(repo => 
        octokit.repos.listCommits({ 
          owner: repo.owner.login, 
          repo: repo.name, 
          author: currentUsername,
          per_page: 20,
          since: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        }).catch(() => ({ data: [] }))
      );
      
      const recentCommitsResponses = await Promise.all(recentCommitPromises);
      
      // Fetch pull requests from active repos
      const prPromises = userRepos.data.slice(0, 10).map(repo =>
        octokit.pulls.list({
          owner: repo.owner.login,
          repo: repo.name,
          state: 'all',
          per_page: 20,
          sort: 'updated',
          direction: 'desc'
        }).catch(() => ({ data: [] }))
      );
      
      const prResponses = await Promise.all(prPromises);
      
      // Fetch issues from active repos
      const issuePromises = userRepos.data.slice(0, 10).map(repo =>
        octokit.issues.listForRepo({
          owner: repo.owner.login,
          repo: repo.name,
          state: 'all',
          per_page: 20,
          sort: 'updated',
          direction: 'desc'
        }).catch(() => ({ data: [] }))
      );
      
      const issueResponses = await Promise.all(issuePromises);
      
      // Convert recent commits to pseudo-events
      const commitEvents: Activity[] = [];
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      
      recentCommitsResponses.forEach((response, index) => {
        const repo = userRepos.data[index];
        response.data.forEach(commit => {
          const commitDate = new Date(commit.commit.author?.date || '');
          if (commitDate > sevenDaysAgo && !userEvents.data.some(e => 
            e.type === 'PushEvent' && 
            e.payload.commits?.some((c: any) => c.sha === commit.sha)
          )) {
            commitEvents.push({
              id: `commit-${commit.sha}`,
              type: 'PushEvent',
              created_at: commit.commit.author?.date || '',
              repo: { 
                name: repo.full_name,
                url: repo.html_url
              },
              actor: { 
                login: currentUsername,
                avatar_url: user.avatar_url
              },
              payload: {
                ref: `refs/heads/${repo.default_branch}`,
                commits: [{
                  sha: commit.sha,
                  message: commit.commit.message,
                  author: commit.commit.author,
                  url: commit.html_url,
                  distinct: true
                }],
                size: 1,
                distinct_size: 1,
                head: commit.sha
              }
            });
          }
        });
      });
      
      // Create events for recent PRs not in the feed
      const prEvents: Activity[] = [];
      prResponses.forEach((response, index) => {
        const repo = userRepos.data[index];
        response.data.forEach(pr => {
          if (pr.user?.login === currentUsername && 
              !userEvents.data.some(e => 
                e.type === 'PullRequestEvent' && 
                e.payload.pull_request?.id === pr.id
              )) {
            const eventDate = pr.updated_at || pr.created_at;
            if (new Date(eventDate) > sevenDaysAgo) {
              prEvents.push({
                id: `pr-${pr.id}`,
                type: 'PullRequestEvent',
                created_at: eventDate,
                repo: { 
                  name: repo.full_name,
                  url: repo.html_url
                },
                actor: { 
                  login: currentUsername,
                  avatar_url: user.avatar_url
                },
                payload: {
                  action: pr.state === 'open' ? 'opened' : pr.merged_at ? 'merged' : 'closed',
                  number: pr.number,
                  pull_request: pr
                }
              });
            }
          }
        });
      });
      
      // Create events for recent issues not in the feed
      const issueEvents: Activity[] = [];
      issueResponses.forEach((response, index) => {
        const repo = userRepos.data[index];
        response.data.forEach(issue => {
          if (!issue.pull_request && // Not a PR
              issue.user?.login === currentUsername &&
              !userEvents.data.some(e => 
                e.type === 'IssuesEvent' && 
                e.payload.issue?.id === issue.id
              )) {
            const eventDate = issue.updated_at || issue.created_at;
            if (new Date(eventDate) > sevenDaysAgo) {
              issueEvents.push({
                id: `issue-${issue.id}`,
                type: 'IssuesEvent',
                created_at: eventDate,
                repo: { 
                  name: repo.full_name,
                  url: repo.html_url
                },
                actor: { 
                  login: currentUsername,
                  avatar_url: user.avatar_url
                },
                payload: {
                  action: issue.state === 'open' ? 'opened' : 'closed',
                  issue: issue
                }
              });
            }
          }
        });
      });

      // Filter received events to only include relevant ones
      const filteredReceivedEvents = receivedEvents.data.filter(event => {
        // Keep events where the current user is involved
        if (event.actor.login === currentUsername) return true;
        if (event.repo.name.startsWith(currentUsername + '/')) return true;
        
        // Keep events where user is mentioned
        if (event.type === 'IssueCommentEvent' || event.type === 'PullRequestReviewCommentEvent') {
          const body = event.payload.comment?.body || '';
          return body.includes('@' + currentUsername);
        }
        
        // Keep PRs/Issues where user is author or assignee
        if (event.type === 'PullRequestEvent' && event.payload.pull_request) {
          const pr = event.payload.pull_request;
          return pr.user.login === currentUsername || 
                 pr.assignees?.some((a: any) => a.login === currentUsername) ||
                 pr.requested_reviewers?.some((r: any) => r.login === currentUsername);
        }
        
        if (event.type === 'IssuesEvent' && event.payload.issue) {
          const issue = event.payload.issue;
          return issue.user.login === currentUsername ||
                 issue.assignees?.some((a: any) => a.login === currentUsername);
        }
        
        // Filter out stars/forks from others unless it's user's repo
        if (event.type === 'WatchEvent' || event.type === 'ForkEvent') {
          return event.repo.name.startsWith(currentUsername + '/');
        }
        
        return false;
      });

      // Combine all events
      const allEvents = [
        ...userEvents.data,
        ...filteredReceivedEvents,
        ...commitEvents,
        ...prEvents,
        ...issueEvents
      ];
      
      // Remove duplicates and sort
      const uniqueEvents = Array.from(
        new Map(allEvents.map(e => [e.id, e])).values()
      ).sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      const finalActivities = uniqueEvents.slice(0, 500); // Keep more activities
      setActivities(finalActivities);
      
      // Calculate comprehensive stats
      const enhancedStats = calculateEnhancedStats(
        finalActivities, 
        userRepos.data as Repository[], 
        prResponses,
        user
      );
      
      // Add additional GitHub stats
      enhancedStats.followers = followers.data.length;
      enhancedStats.following = following.data.length;
      enhancedStats.publicGists = gists.data.length;
      enhancedStats.starredRepos = starred.data.length;
      
      setStats(enhancedStats);
      setLastUpdated(new Date());
      
      // Persist to localStorage
      const dataToSave = {
        activities: finalActivities,
        stats: enhancedStats,
        repos: userRepos.data,
        userProfile: user,
        lastUpdated: new Date().toISOString()
      };
      localStorage.setItem('github-tracker-data', JSON.stringify(dataToSave));
      if (tokenToUse) {
        localStorage.setItem('github-tracker-token', tokenToUse);
      }
      
    } catch (err: any) {
      console.error('Error fetching GitHub data:', err);
      setError(err.message || 'Failed to fetch GitHub data');
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Load cached data on mount
  useEffect(() => {
    const savedData = localStorage.getItem('github-tracker-data');
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        setActivities(parsed.activities || []);
        setStats(parsed.stats || null);
        setRepos(parsed.repos || []);
        setUserProfile(parsed.userProfile || null);
        setLastUpdated(parsed.lastUpdated ? new Date(parsed.lastUpdated) : null);
      } catch (e) {
        console.error('Error loading cached data:', e);
      }
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    activities,
    stats,
    repos,
    userProfile,
    loading,
    error,
    lastUpdated,
    fetchData,
    clearError
  };
};