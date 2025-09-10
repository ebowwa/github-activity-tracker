# Repository Tracker CLI

A comprehensive CLI tool to track all your GitHub activities across repositories, pull requests, issues, and comments. Integrates with Doppler for secure secrets management.

## Features

- 📊 Track activities across multiple repos and organizations
- 🔀 Monitor pull requests (opened, closed, merged, reviewed)
- 🐛 Track issues and comments
- 💾 View commit history and statistics
- 🔔 Check unread notifications
- 👀 Real-time activity watching
- 🔐 Doppler integration for secure token management
- 💾 Intelligent caching for better performance
- 📈 Beautiful activity summaries and visualizations

## Installation

```bash
cd cli/repositorytracker
npm install
npm run build
npm link  # For global CLI access
```

## Configuration

### Using Doppler (Recommended)

1. Install Doppler CLI:
```bash
curl -Ls https://cli.doppler.com/install.sh | sh
```

2. Setup Doppler:
```bash
./setup-doppler.sh
```

3. Set your GitHub token in Doppler:
```bash
doppler secrets set GITHUB_TOKEN "your-token-here"
```

### Using Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Required configuration:
- `GITHUB_TOKEN`: Your GitHub personal access token (required scopes: repo, user, read:org)

Optional configuration:
- `GITHUB_USERNAME`: Your GitHub username (auto-detected if not set)
- `GITHUB_ORGS`: Comma-separated list of organizations to track
- `TRACKED_REPOS`: Comma-separated list of specific repos (format: owner/repo)
- `DAYS_BACK`: Number of days to look back (default: 7)
- `OUTPUT_FORMAT`: Output format - table, json, or markdown (default: table)

## Usage

### Show Recent Activities
```bash
gh-tracker activities
gh-tracker a -f json -d 30 -l 100  # JSON format, 30 days, 100 activities
```

### Show Activity Summary
```bash
gh-tracker summary
gh-tracker s -d 14  # 14-day summary
```

### Show Pull Requests
```bash
gh-tracker prs
```

### Show Issues
```bash
gh-tracker issues
```

### Show Notifications
```bash
gh-tracker notifications
```

### Watch for New Activities (Real-time)
```bash
gh-tracker watch
gh-tracker watch -i 30  # Poll every 30 seconds
```

### Show Configuration
```bash
gh-tracker config
```

## Output Formats

- **Table**: Beautiful ASCII tables with colors (default)
- **JSON**: Machine-readable JSON output
- **Markdown**: Markdown formatted tables for documentation

## Examples

### Track Specific Organizations
```bash
GITHUB_ORGS="facebook,google" gh-tracker activities
```

### Track Specific Repositories
```bash
TRACKED_REPOS="torvalds/linux,nodejs/node" gh-tracker summary
```

### Export to Markdown Report
```bash
gh-tracker activities -f markdown > weekly-report.md
```

### Get JSON for Further Processing
```bash
gh-tracker activities -f json | jq '.[] | select(.type == "PullRequestEvent")'
```

## Activity Types Tracked

- **Push Events**: Commits pushed to repositories
- **Pull Requests**: Opened, closed, merged, reviewed
- **Issues**: Opened, closed, commented
- **Comments**: Issue comments, PR review comments
- **Releases**: Published releases
- **Forks**: Repository forks
- **Stars**: Repository stars
- **Create/Delete**: Branch and tag operations

## License

MIT