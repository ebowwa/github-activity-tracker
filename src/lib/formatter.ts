import chalk from 'chalk';
import { table } from 'table';
import { format } from 'date-fns';
import type { ProcessedActivity, ActivitySummary } from '../types';

export class Formatter {
  formatTable(activities: ProcessedActivity[]): string {
    const data = [
      [
        chalk.bold('Time'),
        chalk.bold('Type'),
        chalk.bold('Repository'),
        chalk.bold('Description'),
      ],
    ];

    for (const activity of activities) {
      data.push([
        format(activity.timestamp, 'MMM dd HH:mm'),
        this.colorizeType(activity.type),
        chalk.cyan(activity.repo),
        this.truncate(activity.description, 60),
      ]);
    }

    return table(data, {
      border: {
        topBody: '─',
        topJoin: '┬',
        topLeft: '┌',
        topRight: '┐',
        bottomBody: '─',
        bottomJoin: '┴',
        bottomLeft: '└',
        bottomRight: '┘',
        bodyLeft: '│',
        bodyRight: '│',
        bodyJoin: '│',
        joinBody: '─',
        joinLeft: '├',
        joinRight: '┤',
        joinJoin: '┼',
      },
    });
  }

  formatMarkdown(activities: ProcessedActivity[]): string {
    let md = '# GitHub Activity Report\n\n';
    md += `Generated: ${format(new Date(), 'PPpp')}\n\n`;
    
    md += '## Recent Activities\n\n';
    md += '| Time | Type | Repository | Description |\n';
    md += '|------|------|------------|-------------|\n';
    
    for (const activity of activities) {
      md += `| ${format(activity.timestamp, 'MMM dd HH:mm')} `;
      md += `| ${activity.type} `;
      md += `| ${activity.repo} `;
      md += `| ${activity.description} |\n`;
    }
    
    return md;
  }

  formatJson(activities: ProcessedActivity[]): string {
    return JSON.stringify(activities, null, 2);
  }

  formatSummary(summary: ActivitySummary): string {
    let output = '';
    
    output += chalk.bold.green('\n📊 Activity Summary\n');
    output += chalk.gray('─'.repeat(50)) + '\n\n';
    
    output += chalk.bold('📈 Overview:\n');
    output += `  Total activities: ${chalk.yellow(summary.totalActivities)}\n`;
    output += `  Active repositories: ${chalk.yellow(Object.keys(summary.byRepo).length)}\n`;
    output += `  Activity types: ${chalk.yellow(Object.keys(summary.byType).length)}\n\n`;
    
    output += chalk.bold('🔀 Pull Requests:\n');
    output += `  Opened: ${chalk.green(summary.pullRequests.opened)}\n`;
    output += `  Merged: ${chalk.blue(summary.pullRequests.merged)}\n`;
    output += `  Closed: ${chalk.red(summary.pullRequests.closed)}\n`;
    output += `  Reviewed: ${chalk.magenta(summary.pullRequests.reviewed)}\n\n`;
    
    output += chalk.bold('🐛 Issues:\n');
    output += `  Opened: ${chalk.green(summary.issues.opened)}\n`;
    output += `  Closed: ${chalk.red(summary.issues.closed)}\n`;
    output += `  Commented: ${chalk.blue(summary.issues.commented)}\n\n`;
    
    output += chalk.bold('💾 Commits:\n');
    output += `  Total commits: ${chalk.yellow(summary.commits.total)}\n`;
    output += `  Repositories: ${chalk.cyan(summary.commits.repos.join(', ') || 'None')}\n\n`;
    
    output += chalk.bold('📅 Activity by Day:\n');
    const sortedDays = Object.entries(summary.byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-7);
    
    for (const [day, count] of sortedDays) {
      const bar = '█'.repeat(Math.min(count, 20));
      output += `  ${format(new Date(day), 'EEE MMM dd')}: ${chalk.green(bar)} ${count}\n`;
    }
    
    output += '\n' + chalk.bold('🏆 Top Repositories:\n');
    const topRepos = Object.entries(summary.byRepo)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);
    
    for (const [repo, count] of topRepos) {
      output += `  ${chalk.cyan(repo)}: ${chalk.yellow(count)} activities\n`;
    }
    
    return output;
  }

  private colorizeType(type: string): string {
    const typeColors: Record<string, (text: string) => string> = {
      'PushEvent': chalk.green,
      'PullRequestEvent': chalk.blue,
      'IssuesEvent': chalk.yellow,
      'IssueCommentEvent': chalk.magenta,
      'CreateEvent': chalk.cyan,
      'DeleteEvent': chalk.red,
      'ForkEvent': chalk.white,
      'WatchEvent': chalk.gray,
      'ReleaseEvent': chalk.bold.green,
      'PullRequestReviewEvent': chalk.blue,
      'PullRequestReviewCommentEvent': chalk.blue,
    };
    
    const colorFn = typeColors[type] || chalk.white;
    return colorFn(type.replace('Event', ''));
  }

  private truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }
}