# GitHub Activity Tracker Web Dashboard

A modern web dashboard for tracking GitHub activities, built with Vite, React, TypeScript, and Tailwind CSS. Deployable on Vercel with Doppler integration for secrets management.

## Features

- 📊 Real-time GitHub activity dashboard
- 📈 Activity statistics (PRs, Issues, Commits)
- 🎨 Beautiful Tailwind CSS design with dark mode
- 🔐 Secure token handling via Doppler
- ⚡ Fast Vite build system
- 🚀 Vercel deployment ready

## Local Development

```bash
cd web
npm install
npm run dev
```

Visit http://localhost:5173

## Deployment on Vercel

### 1. Deploy to Vercel

```bash
npm i -g vercel
vercel
```

### 2. Configure Environment Variables

In Vercel Dashboard, add:
- `GITHUB_TOKEN` - Your GitHub personal access token
- `GITHUB_USERNAME` - Your GitHub username (optional)

### 3. Connect with Doppler (Recommended)

1. Install Doppler Vercel Integration:
   - Go to Vercel Dashboard → Integrations
   - Search for "Doppler"
   - Install and connect your Doppler project

2. Configure Doppler:
```bash
doppler setup --project github-activity-tracker --config prd
doppler secrets set GITHUB_TOKEN "your-token"
doppler secrets set GITHUB_USERNAME "your-username"
```

The integration will automatically sync secrets to Vercel.

## Usage

### With Token Input
If no environment variable is set, users can enter their GitHub token in the UI.

### With Environment Variables
Set `VITE_GITHUB_TOKEN` for automatic authentication:
- Local: Add to `.env.local`
- Vercel: Add to environment variables

## API Route

The app includes a serverless API route at `/api/github-activities` that:
- Fetches GitHub activities
- Handles authentication
- Returns formatted data

## Tech Stack

- **Frontend**: React 18 + TypeScript
- **Styling**: Tailwind CSS
- **Build**: Vite
- **Deployment**: Vercel
- **Secrets**: Doppler
- **API**: GitHub REST API via Octokit

## Security

- Tokens are never stored in localStorage
- API routes handle tokens securely
- Doppler manages production secrets
- Environment variables for sensitive data

## License

MIT