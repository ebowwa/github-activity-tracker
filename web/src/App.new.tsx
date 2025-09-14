import { useState, useEffect, useMemo, useCallback } from 'react';
import { format, subDays, startOfDay } from 'date-fns';

// Hooks
import { useGitHubData } from './hooks/useGitHubData';

// Components
import { Header } from './components/Header';
import { FilterBar } from './components/FilterBar';
import { MetricsGrid } from './components/MetricsGrid';
import { ActivityTimeline } from './components/ActivityTimeline';
import { RepositoryView } from './components/RepositoryView';
import { CollaborationView } from './components/CollaborationView';
import { AnalyticsView } from './components/AnalyticsView';
import { AchievementsView } from './components/AchievementsView';

// Types
import { FilterOptions, ViewMode, Activity } from './types';

// Utils
import { getActivityDescription } from './utils/activityHelpers';

function App() {
  // State
  const [token, setToken] = useState('');
  const [filters, setFilters] = useState<FilterOptions>({
    dateRange: '7d',
    activityTypes: [],
    repositories: [],
    searchQuery: '',
    showPrivate: true
  });
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [autoRefresh, setAutoRefresh] = useState(true);

  // GitHub data hook
  const {
    activities,
    stats,
    repos,
    userProfile,
    loading,
    error,
    lastUpdated,
    fetchData,
    clearError
  } = useGitHubData(token);

  // Load saved preferences
  useEffect(() => {
    const savedToken = localStorage.getItem('github-tracker-token');
    const savedFilters = localStorage.getItem('github-tracker-filters');
    const savedViewMode = localStorage.getItem('github-tracker-view-mode');
    
    if (savedToken) setToken(savedToken);
    if (savedFilters) {
      try {
        setFilters(JSON.parse(savedFilters));
      } catch (e) {
        console.error('Failed to parse saved filters:', e);
      }
    }
    if (savedViewMode) setViewMode(savedViewMode as ViewMode);
    
    // Check for environment token
    const envToken = import.meta.env.VITE_GITHUB_TOKEN;
    if (envToken) {
      setToken(envToken);
      fetchData(envToken);
    }
  }, []);

  // Save preferences
  useEffect(() => {
    localStorage.setItem('github-tracker-filters', JSON.stringify(filters));
  }, [filters]);

  useEffect(() => {
    localStorage.setItem('github-tracker-view-mode', viewMode);
  }, [viewMode]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh || !token) return;
    
    const interval = setInterval(() => {
      fetchData(token);
    }, 60000); // Refresh every minute
    
    return () => clearInterval(interval);
  }, [autoRefresh, token, fetchData]);

  // Filter activities
  const filteredActivities = useMemo(() => {
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
      case 'year':
        startDate = subDays(now, 365);
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
    
    // Language filter
    if (filters.language) {
      const reposWithLanguage = repos
        .filter(r => r.language === filters.language)
        .map(r => r.full_name);
      filtered = filtered.filter(activity => 
        reposWithLanguage.includes(activity.repo.name)
      );
    }
    
    // Collaborator filter
    if (filters.collaborator) {
      filtered = filtered.filter(activity => 
        activity.actor.login === filters.collaborator
      );
    }
    
    // Private repo filter
    if (!filters.showPrivate) {
      const publicRepos = repos
        .filter(r => !r.private)
        .map(r => r.full_name);
      filtered = filtered.filter(activity => 
        publicRepos.includes(activity.repo.name)
      );
    }
    
    // Search query
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(activity => {
        const description = getActivityDescription(activity).toLowerCase();
        const repoName = activity.repo.name.toLowerCase();
        const actorName = activity.actor.login.toLowerCase();
        
        // Search in commit messages
        let commitMessages = '';
        if (activity.type === 'PushEvent' && activity.payload.commits) {
          commitMessages = activity.payload.commits
            .map((c: any) => c.message || '')
            .join(' ')
            .toLowerCase();
        }
        
        // Search in PR/Issue titles
        let title = '';
        if (activity.payload.pull_request?.title) {
          title = activity.payload.pull_request.title.toLowerCase();
        } else if (activity.payload.issue?.title) {
          title = activity.payload.issue.title.toLowerCase();
        }
        
        return description.includes(query) || 
               repoName.includes(query) || 
               actorName.includes(query) ||
               commitMessages.includes(query) ||
               title.includes(query);
      });
    }
    
    return filtered;
  }, [activities, filters, repos]);

  // Export data
  const exportData = useCallback(() => {
    const dataStr = JSON.stringify({
      activities: filteredActivities,
      stats,
      repos,
      userProfile,
      filters,
      exportDate: new Date().toISOString()
    }, null, 2);
    
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `github-activity-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  }, [filteredActivities, stats, repos, userProfile, filters]);

  // Get unique values for filters
  const collaborators = useMemo(() => {
    const collabSet = new Set<string>();
    activities.forEach(activity => {
      if (activity.actor.login !== userProfile?.login) {
        collabSet.add(activity.actor.login);
      }
    });
    return Array.from(collabSet).sort();
  }, [activities, userProfile]);

  const languages = useMemo(() => {
    const langSet = new Set<string>();
    repos.forEach(repo => {
      if (repo.language) langSet.add(repo.language);
    });
    return Array.from(langSet).sort();
  }, [repos]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <Header
          userProfile={userProfile}
          stats={stats}
          viewMode={viewMode}
          setViewMode={setViewMode}
          token={token}
          setToken={setToken}
          loading={loading}
          onRefresh={() => fetchData(token)}
          autoRefresh={autoRefresh}
          setAutoRefresh={setAutoRefresh}
          onExport={exportData}
          lastUpdated={lastUpdated}
        />

        {/* Error Display */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6 flex justify-between items-center">
            <span>{error}</span>
            <button
              onClick={clearError}
              className="text-red-700 hover:text-red-900"
            >
              ✕
            </button>
          </div>
        )}

        {/* Filter Bar */}
        <FilterBar
          filters={filters}
          setFilters={setFilters}
          activities={activities}
          filteredCount={filteredActivities.length}
          totalCount={activities.length}
          repositories={repos}
          collaborators={collaborators}
          languages={languages}
        />

        {/* Main Content */}
        {stats && (
          <>
            {viewMode === 'grid' && (
              <MetricsGrid stats={stats} />
            )}
            
            {viewMode === 'timeline' && (
              <ActivityTimeline 
                activities={filteredActivities}
                userProfile={userProfile}
              />
            )}
            
            {viewMode === 'analytics' && (
              <AnalyticsView 
                stats={stats}
                activities={filteredActivities}
              />
            )}
            
            {viewMode === 'repositories' && (
              <RepositoryView 
                repositories={repos}
                stats={stats}
                activities={filteredActivities}
              />
            )}
            
            {viewMode === 'collaborations' && (
              <CollaborationView 
                stats={stats}
                activities={filteredActivities}
                userProfile={userProfile}
              />
            )}
            
            {viewMode === 'achievements' && (
              <AchievementsView 
                stats={stats}
                activities={filteredActivities}
                userProfile={userProfile}
              />
            )}
          </>
        )}

        {/* Loading State */}
        {loading && !stats && (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin text-4xl mb-4">⏳</div>
              <p className="text-gray-600">Loading GitHub data...</p>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && activities.length === 0 && (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <div className="text-6xl mb-4">📊</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              No Activity Data Yet
            </h2>
            <p className="text-gray-600 mb-6">
              Enter your GitHub token and click Refresh to load your activity dashboard
            </p>
            {!token && (
              <p className="text-sm text-gray-500">
                You can generate a personal access token at{' '}
                <a 
                  href="https://github.com/settings/tokens" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  GitHub Settings → Developer settings → Personal access tokens
                </a>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;