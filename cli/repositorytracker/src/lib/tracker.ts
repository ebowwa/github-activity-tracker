import ora from 'ora';
import { GitHubClient } from './github-client';
import { ActivityProcessor } from './activity-processor';
import { Formatter } from './formatter';
import { Cache } from './cache';
import type { ProcessedActivity, ActivitySummary } from '../types';

export class ActivityTracker {
  private client: GitHubClient;
  private processor: ActivityProcessor;
  private formatter: Formatter;
  private cache: Cache;
  private config: any;

  constructor(config: any) {
    this.config = config;
    this.client = new GitHubClient(config.githubToken, config.githubUsername);
    this.processor = new ActivityProcessor();
    this.formatter = new Formatter();
    this.cache = new Cache(config.cacheDir);
  }

  async init(): Promise<void> {
    await this.cache.init();
  }

  async fetchAllActivities(): Promise<ProcessedActivity[]> {
    const spinner = ora('Fetching GitHub activities...').start();
    const activities: ProcessedActivity[] = [];

    try {
      const username = await this.client.getCurrentUser();
      spinner.text = `Fetching activities for ${username}...`;

      const cacheKey = `activities-${username}-${Date.now()}`;
      const cached = await this.cache.get<ProcessedActivity[]>(cacheKey);
      
      if (cached) {
        spinner.succeed('Loaded activities from cache');
        return cached;
      }

      const [userEvents, receivedEvents] = await Promise.all([
        this.client.getUserEvents(username),
        this.client.getReceivedEvents(username),
      ]);

      const allEvents = [...userEvents, ...receivedEvents];
      
      if (this.config.githubOrgs.length > 0) {
        spinner.text = 'Fetching organization activities...';
        for (const org of this.config.githubOrgs) {
          try {
            const orgEvents = await this.client.getOrgEvents(org, username);
            allEvents.push(...orgEvents);
          } catch (error) {
            spinner.warn(`Failed to fetch events for org ${org}`);
          }
        }
      }

      if (this.config.trackedRepos.length > 0) {
        spinner.text = 'Fetching repository activities...';
        for (const repo of this.config.trackedRepos) {
          try {
            const [owner, name] = repo.split('/');
            const repoEvents = await this.client.getRepoEvents(owner, name);
            allEvents.push(...repoEvents.filter(e => e.actor.login === username));
          } catch (error) {
            spinner.warn(`Failed to fetch events for repo ${repo}`);
          }
        }
      }

      const uniqueEvents = Array.from(
        new Map(allEvents.map(e => [e.id, e])).values()
      );

      for (const event of uniqueEvents) {
        activities.push(this.processor.processEvent(event));
      }

      activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      await this.cache.set(cacheKey, activities, 300); // Cache for 5 minutes

      spinner.succeed(`Fetched ${activities.length} activities`);
    } catch (error) {
      spinner.fail('Failed to fetch activities');
      throw error;
    }

    return activities;
  }

  async fetchPullRequests(): Promise<void> {
    const spinner = ora('Fetching pull requests...').start();
    
    try {
      const username = await this.client.getCurrentUser();
      const prs = await this.client.getUserPullRequests(username);
      
      spinner.succeed(`Found ${prs.length} pull requests`);
      
      console.log('\n📋 Recent Pull Requests:\n');
      for (const pr of prs.slice(0, 10)) {
        const status = pr.merged ? '✅ Merged' : pr.state === 'open' ? '🟢 Open' : '🔴 Closed';
        console.log(`  ${status} #${pr.number} - ${pr.title}`);
        console.log(`    ${pr.repo} | ${pr.html_url}`);
      }
    } catch (error) {
      spinner.fail('Failed to fetch pull requests');
      throw error;
    }
  }

  async fetchIssues(): Promise<void> {
    const spinner = ora('Fetching issues...').start();
    
    try {
      const username = await this.client.getCurrentUser();
      const issues = await this.client.getUserIssues(username);
      
      spinner.succeed(`Found ${issues.length} issues`);
      
      console.log('\n🐛 Recent Issues:\n');
      for (const issue of issues.slice(0, 10)) {
        const status = issue.state === 'open' ? '🟢 Open' : '🔴 Closed';
        console.log(`  ${status} #${issue.number} - ${issue.title}`);
        console.log(`    ${issue.repo} | Comments: ${issue.comments}`);
      }
    } catch (error) {
      spinner.fail('Failed to fetch issues');
      throw error;
    }
  }

  async fetchNotifications(): Promise<void> {
    const spinner = ora('Fetching notifications...').start();
    
    try {
      const notifications = await this.client.getNotifications();
      
      spinner.succeed(`Found ${notifications.length} unread notifications`);
      
      if (notifications.length > 0) {
        console.log('\n🔔 Unread Notifications:\n');
        for (const notif of notifications.slice(0, 10)) {
          console.log(`  • ${notif.subject.title}`);
          console.log(`    ${notif.repository.full_name} | ${notif.reason}`);
        }
      }
    } catch (error) {
      spinner.fail('Failed to fetch notifications');
      throw error;
    }
  }

  displayActivities(activities: ProcessedActivity[], format: string): void {
    switch (format) {
      case 'json':
        console.log(this.formatter.formatJson(activities));
        break;
      case 'markdown':
        console.log(this.formatter.formatMarkdown(activities));
        break;
      case 'table':
      default:
        console.log(this.formatter.formatTable(activities));
        break;
    }
  }

  displaySummary(activities: ProcessedActivity[]): void {
    const summary = this.processor.summarizeActivities(activities, this.config.daysBack);
    console.log(this.formatter.formatSummary(summary));
  }
}