import { format, startOfDay, subDays } from 'date-fns';
import type { GitHubActivity, ProcessedActivity, ActivitySummary } from '../types';

export class ActivityProcessor {
  processEvent(event: GitHubActivity): ProcessedActivity {
    const base = {
      id: event.id,
      type: event.type,
      repo: event.repo.name,
      timestamp: new Date(event.created_at),
    };

    switch (event.type) {
      case 'PushEvent':
        return {
          ...base,
          action: 'pushed',
          description: `Pushed ${event.payload.commits?.length || 0} commit(s) to ${event.payload.ref?.replace('refs/heads/', '')}`,
          details: {
            branch: event.payload.ref?.replace('refs/heads/', ''),
            commits: event.payload.commits?.length || 0,
            messages: event.payload.commits?.map((c: any) => c.message) || [],
          },
        };

      case 'PullRequestEvent':
        return {
          ...base,
          action: event.payload.action,
          description: `${event.payload.action} PR #${event.payload.pull_request.number}: ${event.payload.pull_request.title}`,
          url: event.payload.pull_request.html_url,
          details: {
            pr_number: event.payload.pull_request.number,
            pr_title: event.payload.pull_request.title,
            pr_state: event.payload.pull_request.state,
            merged: event.payload.pull_request.merged,
          },
        };

      case 'IssuesEvent':
        return {
          ...base,
          action: event.payload.action,
          description: `${event.payload.action} issue #${event.payload.issue.number}: ${event.payload.issue.title}`,
          url: event.payload.issue.html_url,
          details: {
            issue_number: event.payload.issue.number,
            issue_title: event.payload.issue.title,
            issue_state: event.payload.issue.state,
          },
        };

      case 'IssueCommentEvent':
        return {
          ...base,
          action: 'commented',
          description: `Commented on issue #${event.payload.issue.number}: ${event.payload.issue.title}`,
          url: event.payload.comment.html_url,
          details: {
            issue_number: event.payload.issue.number,
            issue_title: event.payload.issue.title,
            comment_preview: event.payload.comment.body?.substring(0, 100),
          },
        };

      case 'CreateEvent':
        return {
          ...base,
          action: 'created',
          description: `Created ${event.payload.ref_type} ${event.payload.ref || ''}`,
          details: {
            ref_type: event.payload.ref_type,
            ref: event.payload.ref,
          },
        };

      case 'DeleteEvent':
        return {
          ...base,
          action: 'deleted',
          description: `Deleted ${event.payload.ref_type} ${event.payload.ref}`,
          details: {
            ref_type: event.payload.ref_type,
            ref: event.payload.ref,
          },
        };

      case 'ForkEvent':
        return {
          ...base,
          action: 'forked',
          description: `Forked repository to ${event.payload.forkee.full_name}`,
          url: event.payload.forkee.html_url,
          details: {
            fork_name: event.payload.forkee.full_name,
          },
        };

      case 'WatchEvent':
        return {
          ...base,
          action: 'starred',
          description: `Starred repository`,
        };

      case 'ReleaseEvent':
        return {
          ...base,
          action: 'released',
          description: `${event.payload.action} release ${event.payload.release.tag_name}: ${event.payload.release.name}`,
          url: event.payload.release.html_url,
          details: {
            tag: event.payload.release.tag_name,
            name: event.payload.release.name,
          },
        };

      case 'PullRequestReviewEvent':
        return {
          ...base,
          action: 'reviewed',
          description: `Reviewed PR #${event.payload.pull_request.number}: ${event.payload.pull_request.title}`,
          url: event.payload.review.html_url,
          details: {
            pr_number: event.payload.pull_request.number,
            pr_title: event.payload.pull_request.title,
            review_state: event.payload.review.state,
          },
        };

      case 'PullRequestReviewCommentEvent':
        return {
          ...base,
          action: 'review_commented',
          description: `Commented on PR #${event.payload.pull_request.number} review`,
          url: event.payload.comment.html_url,
          details: {
            pr_number: event.payload.pull_request.number,
            pr_title: event.payload.pull_request.title,
          },
        };

      default:
        return {
          ...base,
          action: event.type.replace('Event', '').toLowerCase(),
          description: `${event.type} on ${event.repo.name}`,
        };
    }
  }

  summarizeActivities(activities: ProcessedActivity[], daysBack = 7): ActivitySummary {
    const now = new Date();
    const cutoffDate = subDays(startOfDay(now), daysBack);
    
    const filteredActivities = activities.filter(a => a.timestamp >= cutoffDate);

    const summary: ActivitySummary = {
      totalActivities: filteredActivities.length,
      byType: {},
      byRepo: {},
      byDay: {},
      recentActivities: filteredActivities.slice(0, 20),
      pullRequests: {
        opened: 0,
        closed: 0,
        merged: 0,
        reviewed: 0,
      },
      issues: {
        opened: 0,
        closed: 0,
        commented: 0,
      },
      commits: {
        total: 0,
        repos: [],
      },
    };

    const commitRepos = new Set<string>();

    for (const activity of filteredActivities) {
      summary.byType[activity.type] = (summary.byType[activity.type] || 0) + 1;
      summary.byRepo[activity.repo] = (summary.byRepo[activity.repo] || 0) + 1;
      
      const dayKey = format(activity.timestamp, 'yyyy-MM-dd');
      summary.byDay[dayKey] = (summary.byDay[dayKey] || 0) + 1;

      switch (activity.type) {
        case 'PullRequestEvent':
          if (activity.action === 'opened') summary.pullRequests.opened++;
          if (activity.action === 'closed') {
            if (activity.details?.merged) {
              summary.pullRequests.merged++;
            } else {
              summary.pullRequests.closed++;
            }
          }
          break;
        case 'PullRequestReviewEvent':
          summary.pullRequests.reviewed++;
          break;
        case 'IssuesEvent':
          if (activity.action === 'opened') summary.issues.opened++;
          if (activity.action === 'closed') summary.issues.closed++;
          break;
        case 'IssueCommentEvent':
          summary.issues.commented++;
          break;
        case 'PushEvent':
          summary.commits.total += activity.details?.commits || 0;
          commitRepos.add(activity.repo);
          break;
      }
    }

    summary.commits.repos = Array.from(commitRepos);

    return summary;
  }
}