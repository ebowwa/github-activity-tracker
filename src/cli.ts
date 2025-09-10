#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { loadConfig } from './config';
import { ActivityTracker } from './lib/tracker';

const program = new Command();

program
  .name('gh-tracker')
  .description('Track all your GitHub activities across repos, PRs, issues, and comments')
  .version('1.0.0');

program
  .command('activities')
  .alias('a')
  .description('Show recent GitHub activities')
  .option('-f, --format <format>', 'Output format (table, json, markdown)', 'table')
  .option('-d, --days <days>', 'Number of days to look back', '7')
  .option('-l, --limit <limit>', 'Maximum number of activities to show', '50')
  .action(async (options) => {
    try {
      const config = loadConfig();
      config.daysBack = parseInt(options.days, 10);
      
      const tracker = new ActivityTracker(config);
      await tracker.init();
      
      const activities = await tracker.fetchAllActivities();
      const limited = activities.slice(0, parseInt(options.limit, 10));
      
      tracker.displayActivities(limited, options.format);
    } catch (error) {
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  });

program
  .command('summary')
  .alias('s')
  .description('Show activity summary and statistics')
  .option('-d, --days <days>', 'Number of days to analyze', '7')
  .action(async (options) => {
    try {
      const config = loadConfig();
      config.daysBack = parseInt(options.days, 10);
      
      const tracker = new ActivityTracker(config);
      await tracker.init();
      
      const activities = await tracker.fetchAllActivities();
      tracker.displaySummary(activities);
    } catch (error) {
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  });

program
  .command('prs')
  .description('Show pull request activity')
  .action(async () => {
    try {
      const config = loadConfig();
      const tracker = new ActivityTracker(config);
      await tracker.init();
      await tracker.fetchPullRequests();
    } catch (error) {
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  });

program
  .command('issues')
  .description('Show issue activity')
  .action(async () => {
    try {
      const config = loadConfig();
      const tracker = new ActivityTracker(config);
      await tracker.init();
      await tracker.fetchIssues();
    } catch (error) {
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  });

program
  .command('notifications')
  .alias('notifs')
  .description('Show unread notifications')
  .action(async () => {
    try {
      const config = loadConfig();
      const tracker = new ActivityTracker(config);
      await tracker.init();
      await tracker.fetchNotifications();
    } catch (error) {
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  });

program
  .command('watch')
  .description('Watch for new activities in real-time')
  .option('-i, --interval <seconds>', 'Polling interval in seconds', '60')
  .action(async (options) => {
    try {
      const config = loadConfig();
      const tracker = new ActivityTracker(config);
      await tracker.init();
      
      console.log(chalk.green('👀 Watching for new activities...'));
      console.log(chalk.gray(`Polling every ${options.interval} seconds. Press Ctrl+C to stop.\n`));
      
      let lastActivityId: string | null = null;
      
      const checkActivities = async () => {
        const activities = await tracker.fetchAllActivities();
        
        if (activities.length > 0) {
          if (lastActivityId && activities[0].id !== lastActivityId) {
            const newActivities = [];
            for (const activity of activities) {
              if (activity.id === lastActivityId) break;
              newActivities.push(activity);
            }
            
            if (newActivities.length > 0) {
              console.log(chalk.yellow(`\n🆕 ${newActivities.length} new activities:\n`));
              tracker.displayActivities(newActivities, 'table');
            }
          }
          
          lastActivityId = activities[0].id;
        }
      };
      
      await checkActivities();
      setInterval(checkActivities, parseInt(options.interval, 10) * 1000);
    } catch (error) {
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  });

program
  .command('config')
  .description('Show current configuration')
  .action(() => {
    try {
      const config = loadConfig();
      console.log(chalk.bold('\n⚙️  Current Configuration:\n'));
      console.log(`  GitHub Token: ${config.githubToken ? '✅ Set' : '❌ Not set'}`);
      console.log(`  Using Doppler: ${config.useDoppler ? '✅ Yes' : '❌ No'}`);
      console.log(`  GitHub Username: ${config.githubUsername || 'Auto-detect'}`);
      console.log(`  Tracked Orgs: ${config.githubOrgs.join(', ') || 'None'}`);
      console.log(`  Tracked Repos: ${config.trackedRepos.join(', ') || 'None'}`);
      console.log(`  Days Back: ${config.daysBack}`);
      console.log(`  Cache Directory: ${config.cacheDir}`);
      console.log(`  Output Format: ${config.outputFormat}\n`);
    } catch (error) {
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  });

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}