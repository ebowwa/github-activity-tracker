import { Activity } from '../types';

export const getActivityIcon = (type: string): string => {
  const iconMap: Record<string, string> = {
    'PushEvent': '🚀',
    'PullRequestEvent': '🔀',
    'IssuesEvent': '📝',
    'IssueCommentEvent': '💬',
    'WatchEvent': '⭐',
    'ForkEvent': '🍴',
    'CreateEvent': '✨',
    'DeleteEvent': '🗑️',
    'ReleaseEvent': '🎉',
    'PullRequestReviewEvent': '👀',
    'PullRequestReviewCommentEvent': '💭',
    'GollumEvent': '📚',
    'PublicEvent': '🌍',
    'MemberEvent': '👥',
    'CommitCommentEvent': '📝',
    'FollowEvent': '👤',
    'GistEvent': '📋',
    'SponsorshipEvent': '💖',
    'TeamAddEvent': '👫',
    'MarketplacePurchaseEvent': '🛒',
    'WorkflowRunEvent': '⚙️',
    'DeploymentEvent': '🚢',
    'DeploymentStatusEvent': '📡',
    'StatusEvent': '📊',
    'CheckRunEvent': '✅',
    'CheckSuiteEvent': '🔍',
    'CodeScanningAlertEvent': '🔒',
    'SecretScanningAlertEvent': '🔐',
    'DependabotAlertEvent': '🤖',
    'DiscussionEvent': '💭',
    'DiscussionCommentEvent': '💬',
  };
  return iconMap[type] || '📌';
};

export const getActivityDescription = (activity: Activity): string => {
  const actor = activity.actor.login;
  const repo = activity.repo.name;
  
  switch (activity.type) {
    case 'PushEvent':
      const commitCount = activity.payload.commits?.length || activity.payload.size || 0;
      const branch = activity.payload.ref?.replace('refs/heads/', '') || 'main';
      const distinctSize = activity.payload.distinct_size || commitCount;
      return `${actor} pushed ${commitCount} commit${commitCount !== 1 ? 's' : ''} to ${branch} in ${repo}`;
    
    case 'PullRequestEvent':
      const prAction = activity.payload.action;
      const prNumber = activity.payload.number || activity.payload.pull_request?.number;
      const prTitle = activity.payload.pull_request?.title;
      return `${actor} ${prAction} PR #${prNumber}${prTitle ? `: "${prTitle}"` : ''} in ${repo}`;
    
    case 'IssuesEvent':
      const issueAction = activity.payload.action;
      const issueNumber = activity.payload.issue?.number;
      const issueTitle = activity.payload.issue?.title;
      return `${actor} ${issueAction} issue #${issueNumber}${issueTitle ? `: "${issueTitle}"` : ''} in ${repo}`;
    
    case 'IssueCommentEvent':
      const commentIssueNumber = activity.payload.issue?.number;
      const commentSnippet = activity.payload.comment?.body?.substring(0, 50);
      return `${actor} commented on issue #${commentIssueNumber} in ${repo}${commentSnippet ? `: "${commentSnippet}..."` : ''}`;
    
    case 'WatchEvent':
      return `${actor} starred ${repo}`;
    
    case 'ForkEvent':
      const forkee = activity.payload.forkee?.full_name;
      return `${actor} forked ${repo}${forkee ? ` to ${forkee}` : ''}`;
    
    case 'CreateEvent':
      const refType = activity.payload.ref_type;
      const ref = activity.payload.ref;
      if (refType === 'repository') {
        return `${actor} created repository ${repo}`;
      }
      return `${actor} created ${refType} ${ref ? `"${ref}"` : ''} in ${repo}`;
    
    case 'DeleteEvent':
      const deleteRefType = activity.payload.ref_type;
      const deleteRef = activity.payload.ref;
      return `${actor} deleted ${deleteRefType} ${deleteRef ? `"${deleteRef}"` : ''} in ${repo}`;
    
    case 'ReleaseEvent':
      const releaseAction = activity.payload.action;
      const releaseName = activity.payload.release?.name || activity.payload.release?.tag_name;
      return `${actor} ${releaseAction} release ${releaseName ? `"${releaseName}"` : ''} in ${repo}`;
    
    case 'PullRequestReviewEvent':
      const reviewState = activity.payload.review?.state;
      const reviewPR = activity.payload.pull_request?.number;
      return `${actor} ${reviewState || 'reviewed'} PR #${reviewPR} in ${repo}`;
    
    case 'PullRequestReviewCommentEvent':
      const reviewCommentPR = activity.payload.pull_request?.number;
      return `${actor} commented on PR #${reviewCommentPR} review in ${repo}`;
    
    case 'GollumEvent':
      const pages = activity.payload.pages || [];
      const pageAction = pages[0]?.action || 'updated';
      const pageTitle = pages[0]?.title;
      return `${actor} ${pageAction} wiki page${pageTitle ? ` "${pageTitle}"` : ''} in ${repo}`;
    
    case 'PublicEvent':
      return `${actor} made ${repo} public`;
    
    case 'MemberEvent':
      const memberAction = activity.payload.action;
      const member = activity.payload.member?.login;
      return `${actor} ${memberAction} ${member} as a collaborator to ${repo}`;
    
    case 'CommitCommentEvent':
      const commitSha = activity.payload.comment?.commit_id?.substring(0, 7);
      return `${actor} commented on commit ${commitSha} in ${repo}`;
    
    case 'GistEvent':
      const gistAction = activity.payload.action;
      const gistId = activity.payload.gist?.id;
      return `${actor} ${gistAction} gist ${gistId}`;
    
    case 'FollowEvent':
      const target = activity.payload.target?.login;
      return `${actor} started following ${target}`;
    
    case 'TeamAddEvent':
      const team = activity.payload.team?.name;
      return `${actor} was added to team ${team}`;
    
    case 'DeploymentEvent':
      const environment = activity.payload.deployment?.environment;
      return `${actor} deployed to ${environment} in ${repo}`;
    
    case 'WorkflowRunEvent':
      const workflowName = activity.payload.workflow?.name;
      const workflowConclusion = activity.payload.workflow_run?.conclusion;
      return `${actor}'s workflow "${workflowName}" ${workflowConclusion} in ${repo}`;
    
    case 'DiscussionEvent':
      const discussionAction = activity.payload.action;
      const discussionTitle = activity.payload.discussion?.title;
      return `${actor} ${discussionAction} discussion "${discussionTitle}" in ${repo}`;
    
    default:
      return `${actor} performed ${activity.type.replace('Event', '')} on ${repo}`;
  }
};

export const getActivityColor = (type: string): string => {
  const colorMap: Record<string, string> = {
    'PushEvent': 'blue',
    'PullRequestEvent': 'purple',
    'IssuesEvent': 'green',
    'IssueCommentEvent': 'yellow',
    'WatchEvent': 'orange',
    'ForkEvent': 'indigo',
    'CreateEvent': 'teal',
    'DeleteEvent': 'red',
    'ReleaseEvent': 'pink',
  };
  return colorMap[type] || 'gray';
};

export const groupActivitiesByDate = (activities: Activity[]): Map<string, Activity[]> => {
  const grouped = new Map<string, Activity[]>();
  
  activities.forEach(activity => {
    const date = new Date(activity.created_at).toLocaleDateString();
    if (!grouped.has(date)) {
      grouped.set(date, []);
    }
    grouped.get(date)!.push(activity);
  });
  
  return grouped;
};

export const groupActivitiesByRepo = (activities: Activity[]): Map<string, Activity[]> => {
  const grouped = new Map<string, Activity[]>();
  
  activities.forEach(activity => {
    const repo = activity.repo.name;
    if (!grouped.has(repo)) {
      grouped.set(repo, []);
    }
    grouped.get(repo)!.push(activity);
  });
  
  return grouped;
};

export const getCommitMessage = (activity: Activity): string | null => {
  if (activity.type !== 'PushEvent') return null;
  
  const commits = activity.payload.commits || [];
  if (commits.length === 0) return null;
  
  // Return the first commit message, truncated if needed
  const message = commits[0].message;
  return message ? (message.length > 100 ? message.substring(0, 100) + '...' : message) : null;
};

export const getTimeAgo = (date: string): string => {
  const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
  
  const intervals = [
    { label: 'year', seconds: 31536000 },
    { label: 'month', seconds: 2592000 },
    { label: 'day', seconds: 86400 },
    { label: 'hour', seconds: 3600 },
    { label: 'minute', seconds: 60 },
    { label: 'second', seconds: 1 }
  ];
  
  for (const interval of intervals) {
    const count = Math.floor(seconds / interval.seconds);
    if (count > 0) {
      return count === 1 ? `${count} ${interval.label} ago` : `${count} ${interval.label}s ago`;
    }
  }
  
  return 'just now';
};