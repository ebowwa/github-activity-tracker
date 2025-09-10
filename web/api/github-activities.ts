import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Octokit } from '@octokit/rest';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Get token from Doppler/env or Authorization header
  const token = process.env.GITHUB_TOKEN || req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'GitHub token required' });
  }

  try {
    const octokit = new Octokit({ auth: token });
    
    // Get username from query or env
    const username = (req.query.username as string) || process.env.GITHUB_USERNAME;
    
    let user = username;
    if (!user) {
      const { data } = await octokit.users.getAuthenticated();
      user = data.login;
    }

    // Fetch various activities
    const [userEvents, receivedEvents, notifications] = await Promise.all([
      octokit.activity.listPublicEventsForUser({ 
        username: user, 
        per_page: 100 
      }).catch(() => ({ data: [] })),
      octokit.activity.listReceivedEventsForUser({ 
        username: user, 
        per_page: 100 
      }).catch(() => ({ data: [] })),
      octokit.activity.listNotificationsForAuthenticatedUser({
        all: false,
        participating: true
      }).catch(() => ({ data: [] }))
    ]);

    // Combine and deduplicate events
    const allEvents = [...userEvents.data, ...receivedEvents.data];
    const uniqueEvents = Array.from(
      new Map(allEvents.map(e => [e.id, e])).values()
    ).sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    res.status(200).json({
      username: user,
      activities: uniqueEvents.slice(0, 100),
      notifications: notifications.data,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('GitHub API Error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to fetch GitHub activities' 
    });
  }
}