#!/bin/bash

echo "🔐 GitHub Activity Tracker - Doppler Setup"
echo "=========================================="
echo ""

# Check if Doppler is installed
if ! command -v doppler &> /dev/null; then
    echo "❌ Doppler CLI not found. Please install it first:"
    echo "   curl -Ls https://cli.doppler.com/install.sh | sh"
    exit 1
fi

echo "✅ Doppler CLI is installed"
echo ""

# Setup project if not already done
echo "📦 Setting up Doppler project..."
doppler setup --project github-activity-tracker --config dev --no-interactive

echo ""
echo "🔑 Let's configure your GitHub token"
echo "   Get one from: https://github.com/settings/tokens"
echo "   Required scopes: repo, user, read:org"
echo ""

read -p "Enter your GitHub Personal Access Token: " github_token
if [ -n "$github_token" ]; then
    doppler secrets set GITHUB_TOKEN "$github_token" --config dev --no-interactive
    echo "✅ GitHub token saved to Doppler"
else
    echo "⚠️  No token provided, skipping..."
fi

echo ""
read -p "Enter your GitHub username (optional, press Enter to skip): " github_username
if [ -n "$github_username" ]; then
    doppler secrets set GITHUB_USERNAME "$github_username" --config dev --no-interactive
    echo "✅ GitHub username saved to Doppler"
fi

echo ""
echo "📝 Note: Non-secret configuration like orgs and repos to track"
echo "   should be set in your .env file or passed as environment variables."
echo ""
echo "   Example .env file or command:"
echo "   GITHUB_ORGS=facebook,google"
echo "   TRACKED_REPOS=torvalds/linux,nodejs/node"

echo ""
echo "🎉 Setup complete! Your configuration:"
echo ""
doppler secrets --config dev --only-names

echo ""
echo "📚 Usage Examples:"
echo "   doppler run -- npm run dev activities     # Show recent activities"
echo "   doppler run -- npm run dev summary        # Show activity summary"
echo "   doppler run -- npm run dev watch          # Watch for new activities"
echo ""
echo "💡 Tip: Add this alias to your shell profile for easier usage:"
echo "   alias gh-tracker='doppler run -- npm run dev'"
echo ""