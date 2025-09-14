import { Activity, EnhancedStats, Repository } from '../types';
import { format, subDays } from 'date-fns';

export const calculateEnhancedStats = (
  activities: Activity[], 
  repos: Repository[], 
  prResponses: any[],
  userProfile?: any
): EnhancedStats => {
  const now = new Date();
  const oneDayAgo = subDays(now, 1);
  const sevenDaysAgo = subDays(now, 7);
  const thirtyDaysAgo = subDays(now, 30);
  
  const stats: EnhancedStats = {
    // Basic stats
    totalActivities: activities.length,
    pullRequests: { opened: 0, closed: 0, merged: 0 },
    issues: { opened: 0, closed: 0, commented: 0 },
    commits: 0,
    topRepos: [],
    
    // Time-based
    activitiesLast24h: 0,
    activitiesLast7d: 0,
    activitiesLast30d: 0,
    
    // Extended metrics
    pullRequestsExtended: { 
      opened: 0, 
      closed: 0, 
      merged: 0, 
      reviewed: 0,
      pendingReview: 0
    },
    issuesExtended: { 
      opened: 0, 
      closed: 0, 
      commented: 0,
      labelDistribution: new Map()
    },
    commitsExtended: {
      total: 0,
      filesChanged: 0,
      additions: 0,
      deletions: 0,
      byBranch: new Map(),
      commitMessages: []
    },
    topReposExtended: [],
    totalReposActive: 0,
    repoLanguages: new Map(),
    
    // Collaboration
    collaborators: new Map(),
    mentionsReceived: 0,
    reviewsGiven: 0,
    reviewsReceived: 0,
    teamMembers: [],
    
    // Patterns
    hourlyDistribution: new Array(24).fill(0),
    dailyDistribution: new Array(7).fill(0),
    weeklyTrend: [],
    monthlyTrend: [],
    
    // Languages
    languageBreakdown: new Map(),
    languageActivity: new Map(),
    
    // Productivity
    streakDays: 0,
    longestStreak: 0,
    mostProductiveDay: '',
    mostProductiveHour: 0,
    avgDailyActivities: 0,
    
    // Event types
    eventTypeDistribution: new Map(),
    
    // GitHub profile stats
    followers: userProfile?.followers,
    following: userProfile?.following,
    publicRepos: userProfile?.public_repos,
    publicGists: userProfile?.public_gists,
    starredRepos: userProfile?.starred_repos_count
  };

  const repoStats: Record<string, any> = {};
  const dailyActivities: Record<string, number> = {};
  const monthlyActivities: Record<string, number> = {};
  const uniqueRepos = new Set<string>();
  const uniqueCollaborators = new Set<string>();
  
  // Process each activity
  activities.forEach(activity => {
    const activityDate = new Date(activity.created_at);
    const hour = activityDate.getHours();
    const dayOfWeek = activityDate.getDay();
    const dateKey = format(activityDate, 'yyyy-MM-dd');
    const monthKey = format(activityDate, 'yyyy-MM');
    
    // Time-based counting
    if (activityDate > oneDayAgo) stats.activitiesLast24h++;
    if (activityDate > sevenDaysAgo) stats.activitiesLast7d++;
    if (activityDate > thirtyDaysAgo) stats.activitiesLast30d++;
    
    // Hourly and daily distribution
    stats.hourlyDistribution[hour]++;
    stats.dailyDistribution[dayOfWeek]++;
    
    // Daily and monthly activities
    dailyActivities[dateKey] = (dailyActivities[dateKey] || 0) + 1;
    monthlyActivities[monthKey] = (monthlyActivities[monthKey] || 0) + 1;
    
    // Event type distribution
    const eventCount = stats.eventTypeDistribution.get(activity.type) || 0;
    stats.eventTypeDistribution.set(activity.type, eventCount + 1);
    
    // Repository tracking
    uniqueRepos.add(activity.repo.name);
    if (!repoStats[activity.repo.name]) {
      repoStats[activity.repo.name] = {
        name: activity.repo.name,
        count: 0,
        commits: 0,
        prs: 0,
        issues: 0,
        lastActivity: activity.created_at,
        languages: new Set(),
        contributors: new Set()
      };
    }
    repoStats[activity.repo.name].count++;
    
    // Activity type specific processing
    switch (activity.type) {
      case 'PullRequestEvent':
        repoStats[activity.repo.name].prs++;
        stats.pullRequests[activity.payload.action as keyof typeof stats.pullRequests]++;
        stats.pullRequestsExtended[activity.payload.action as keyof typeof stats.pullRequestsExtended]++;
        
        if (activity.payload.action === 'closed' && activity.payload.pull_request?.merged) {
          stats.pullRequests.merged++;
          stats.pullRequestsExtended.merged++;
          
          // Calculate time to merge if possible
          if (activity.payload.pull_request?.created_at) {
            const createdAt = new Date(activity.payload.pull_request.created_at);
            const mergedAt = new Date(activity.created_at);
            const hoursToMerge = (mergedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
            
            if (!stats.pullRequestsExtended.avgTimeToMerge) {
              stats.pullRequestsExtended.avgTimeToMerge = hoursToMerge;
            } else {
              stats.pullRequestsExtended.avgTimeToMerge = 
                (stats.pullRequestsExtended.avgTimeToMerge + hoursToMerge) / 2;
            }
          }
        }
        
        // Track PR labels
        if (activity.payload.pull_request?.labels) {
          activity.payload.pull_request.labels.forEach((label: any) => {
            const count = stats.issuesExtended.labelDistribution.get(label.name) || 0;
            stats.issuesExtended.labelDistribution.set(label.name, count + 1);
          });
        }
        break;
        
      case 'PullRequestReviewEvent':
        stats.pullRequestsExtended.reviewed++;
        stats.reviewsGiven++;
        break;
        
      case 'IssuesEvent':
        repoStats[activity.repo.name].issues++;
        const issueAction = activity.payload.action as keyof typeof stats.issues;
        if (issueAction in stats.issues) {
          stats.issues[issueAction]++;
          stats.issuesExtended[issueAction]++;
        }
        
        // Track issue labels
        if (activity.payload.issue?.labels) {
          activity.payload.issue.labels.forEach((label: any) => {
            const count = stats.issuesExtended.labelDistribution.get(label.name) || 0;
            stats.issuesExtended.labelDistribution.set(label.name, count + 1);
          });
        }
        
        // Calculate time to close
        if (activity.payload.action === 'closed' && activity.payload.issue?.created_at) {
          const createdAt = new Date(activity.payload.issue.created_at);
          const closedAt = new Date(activity.created_at);
          const hoursToClose = (closedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
          
          if (!stats.issuesExtended.avgTimeToClose) {
            stats.issuesExtended.avgTimeToClose = hoursToClose;
          } else {
            stats.issuesExtended.avgTimeToClose = 
              (stats.issuesExtended.avgTimeToClose + hoursToClose) / 2;
          }
        }
        break;
        
      case 'IssueCommentEvent':
        stats.issues.commented++;
        stats.issuesExtended.commented++;
        
        // Check for mentions
        const commentBody = activity.payload.comment?.body || '';
        const mentionRegex = /@(\w+)/g;
        const mentions = commentBody.match(mentionRegex);
        if (mentions) {
          stats.mentionsReceived += mentions.length;
        }
        break;
        
      case 'PushEvent':
        const commitCount = activity.payload.commits?.length || activity.payload.size || 0;
        stats.commits += commitCount;
        stats.commitsExtended.total += commitCount;
        repoStats[activity.repo.name].commits += commitCount;
        
        // Track branch
        const branch = activity.payload.ref?.replace('refs/heads/', '') || 'main';
        const branchCount = stats.commitsExtended.byBranch.get(branch) || 0;
        stats.commitsExtended.byBranch.set(branch, branchCount + commitCount);
        
        // Collect commit messages
        if (activity.payload.commits) {
          activity.payload.commits.forEach((commit: any) => {
            if (commit.message && stats.commitsExtended.commitMessages.length < 100) {
              stats.commitsExtended.commitMessages.push(commit.message);
            }
            
            // Track additions/deletions if available
            if (commit.stats) {
              stats.commitsExtended.additions += commit.stats.additions || 0;
              stats.commitsExtended.deletions += commit.stats.deletions || 0;
              stats.commitsExtended.filesChanged += commit.stats.total || 0;
            }
          });
        }
        break;
        
      case 'PullRequestReviewCommentEvent':
        stats.reviewsReceived++;
        break;
        
      case 'CreateEvent':
        if (activity.payload.ref_type === 'repository') {
          stats.publicRepos = (stats.publicRepos || 0) + 1;
        }
        break;
        
      case 'ForkEvent':
        // Track forks
        repoStats[activity.repo.name].forks = (repoStats[activity.repo.name].forks || 0) + 1;
        break;
        
      case 'WatchEvent':
        // Track stars
        repoStats[activity.repo.name].stars = (repoStats[activity.repo.name].stars || 0) + 1;
        break;
    }
    
    // Track collaborators
    if (activity.actor.login && activity.actor.login !== userProfile?.login) {
      uniqueCollaborators.add(activity.actor.login);
      const count = stats.collaborators.get(activity.actor.login) || 0;
      stats.collaborators.set(activity.actor.login, count + 1);
    }
  });
  
  // Calculate streak
  const sortedDates = Object.keys(dailyActivities).sort().reverse();
  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;
  
  for (let i = 0; i < sortedDates.length; i++) {
    const checkDate = format(subDays(now, i), 'yyyy-MM-dd');
    if (dailyActivities[checkDate]) {
      if (i === 0 || i === 1) { // Current or yesterday
        currentStreak++;
      }
      tempStreak++;
      longestStreak = Math.max(longestStreak, tempStreak);
    } else {
      if (i > 1) { // Not today or yesterday
        tempStreak = 0;
      }
    }
  }
  stats.streakDays = currentStreak;
  stats.longestStreak = longestStreak;
  
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
  
  // Monthly trend (last 12 months)
  for (let i = 11; i >= 0; i--) {
    const date = subDays(now, i * 30);
    const monthKey = format(date, 'yyyy-MM');
    const monthName = format(date, 'MMM yyyy');
    stats.monthlyTrend.push({
      month: monthName,
      count: monthlyActivities[monthKey] || 0
    });
  }
  
  // Process repository data
  repos.forEach(repo => {
    if (repo.language) {
      const langCount = stats.languageBreakdown.get(repo.language) || 0;
      stats.languageBreakdown.set(repo.language, langCount + 1);
      
      const repoLangCount = stats.repoLanguages.get(repo.language) || 0;
      stats.repoLanguages.set(repo.language, repoLangCount + 1);
    }
    
    // Add repo details to stats if it's active
    if (repoStats[repo.full_name]) {
      repoStats[repo.full_name].stars = repo.stargazers_count;
      repoStats[repo.full_name].forks = repo.forks_count;
      repoStats[repo.full_name].language = repo.language;
    }
  });
  
  // Process PR responses for additional insights
  prResponses.forEach(response => {
    response.data.forEach((pr: any) => {
      if (pr.state === 'open' && pr.requested_reviewers?.length > 0) {
        stats.pullRequestsExtended.pendingReview++;
      }
    });
  });
  
  // Top repositories with extended info
  stats.topReposExtended = Object.values(repoStats)
    .sort((a, b) => b.count - a.count)
    .slice(0, 15)
    .map(repo => ({
      name: repo.name,
      count: repo.count,
      commits: repo.commits,
      prs: repo.prs,
      issues: repo.issues,
      lastActivity: repo.lastActivity,
      stars: repo.stars,
      forks: repo.forks,
      language: repo.language
    }));
  
  // Basic top repos for backward compatibility
  stats.topRepos = stats.topReposExtended.slice(0, 5).map(repo => ({
    name: repo.name,
    count: repo.count
  }));
  
  stats.totalReposActive = uniqueRepos.size;
  stats.teamMembers = Array.from(uniqueCollaborators);
  
  // Language activity breakdown
  activities.forEach(activity => {
    const repoName = activity.repo.name;
    const repoData = repoStats[repoName];
    if (repoData?.language) {
      const lang = repoData.language;
      const langActivity = stats.languageActivity.get(lang) || { commits: 0, prs: 0 };
      
      if (activity.type === 'PushEvent') {
        langActivity.commits += activity.payload.commits?.length || 0;
      } else if (activity.type === 'PullRequestEvent') {
        langActivity.prs++;
      }
      
      stats.languageActivity.set(lang, langActivity);
    }
  });
  
  return stats;
};