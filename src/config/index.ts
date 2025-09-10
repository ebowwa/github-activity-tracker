import dotenv from 'dotenv';
import { execSync } from 'child_process';

dotenv.config();

interface Config {
  githubToken: string;
  githubUsername?: string;
  githubOrgs: string[];
  trackedRepos: string[];
  daysBack: number;
  cacheDir: string;
  outputFormat: 'json' | 'table' | 'markdown';
  useDoppler: boolean;
}

function getSecretFromDoppler(key: string): string | undefined {
  // Only fetch actual secrets from Doppler
  const secretKeys = ['GITHUB_TOKEN', 'GITHUB_USERNAME'];
  if (!secretKeys.includes(key)) {
    return undefined;
  }
  
  try {
    const result = execSync(`doppler secrets get ${key} --plain`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore']
    }).trim();
    return result || undefined;
  } catch {
    return undefined;
  }
}

function isDopplerAvailable(): boolean {
  try {
    execSync('doppler --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export function loadConfig(): Config {
  const useDoppler = isDopplerAvailable() && !process.env.SKIP_DOPPLER;
  
  // Secrets (from Doppler or env)
  let githubToken = process.env.GITHUB_TOKEN;
  let githubUsername = process.env.GITHUB_USERNAME;
  
  if (useDoppler) {
    githubToken = getSecretFromDoppler('GITHUB_TOKEN') || githubToken;
    githubUsername = getSecretFromDoppler('GITHUB_USERNAME') || githubUsername;
    
    if (githubToken && !process.env.GITHUB_TOKEN) {
      console.log('✓ Using GitHub token from Doppler');
    }
  }
  
  if (!githubToken) {
    throw new Error(
      'GitHub token is required. Set GITHUB_TOKEN environment variable or configure Doppler.'
    );
  }
  
  return {
    githubToken,
    githubUsername,
    githubOrgs: process.env.GITHUB_ORGS?.split(',').map(s => s.trim()).filter(Boolean) || [],
    trackedRepos: process.env.TRACKED_REPOS?.split(',').map(s => s.trim()).filter(Boolean) || [],
    daysBack: parseInt(process.env.DAYS_BACK || '7', 10),
    cacheDir: process.env.CACHE_DIR || '.cache',
    outputFormat: (process.env.OUTPUT_FORMAT as Config['outputFormat']) || 'table',
    useDoppler
  };
}