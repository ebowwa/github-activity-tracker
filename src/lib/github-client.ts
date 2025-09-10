import { Octokit } from '@octokit/rest';
import { graphql } from '@octokit/graphql';
import type { GitHubActivity, PRDetails, IssueDetails } from '../types';

export class GitHubClient {
  private octokit: Octokit;
  private graphqlClient: typeof graphql;
  private username?: string;

  constructor(token: string, username?: string) {
    this.octokit = new Octokit({ auth: token });
    this.graphqlClient = graphql.defaults({
      headers: {
        authorization: `token ${token}`,
      },
    });
    this.username = username;
  }

  async getCurrentUser(): Promise<string> {
    if (this.username) return this.username;
    
    const { data } = await this.octokit.users.getAuthenticated();
    this.username = data.login;
    return data.login;
  }

  async getUserEvents(username: string, perPage = 100): Promise<GitHubActivity[]> {
    const { data } = await this.octokit.activity.listPublicEventsForUser({
      username,
      per_page: perPage,
    });
    return data as GitHubActivity[];
  }

  async getReceivedEvents(username: string, perPage = 100): Promise<GitHubActivity[]> {
    const { data } = await this.octokit.activity.listReceivedEventsForUser({
      username,
      per_page: perPage,
    });
    return data as GitHubActivity[];
  }

  async getOrgEvents(org: string, username: string, perPage = 100): Promise<GitHubActivity[]> {
    const { data } = await this.octokit.activity.listPublicOrgEvents({
      org,
      per_page: perPage,
    });
    return data.filter(event => event.actor.login === username) as GitHubActivity[];
  }

  async getRepoEvents(owner: string, repo: string, perPage = 100): Promise<GitHubActivity[]> {
    const { data } = await this.octokit.activity.listRepoEvents({
      owner,
      repo,
      per_page: perPage,
    });
    return data as GitHubActivity[];
  }

  async getUserPullRequests(username: string): Promise<PRDetails[]> {
    const query = `
      query($username: String!) {
        user(login: $username) {
          pullRequests(first: 100, orderBy: {field: CREATED_AT, direction: DESC}) {
            nodes {
              number
              title
              state
              merged
              createdAt
              closedAt
              mergedAt
              url
              repository {
                nameWithOwner
              }
            }
          }
        }
      }
    `;

    const result: any = await this.graphqlClient(query, { username });
    return result.user.pullRequests.nodes.map((pr: any) => ({
      number: pr.number,
      title: pr.title,
      state: pr.state.toLowerCase(),
      merged: pr.merged,
      created_at: pr.createdAt,
      closed_at: pr.closedAt,
      merged_at: pr.mergedAt,
      html_url: pr.url,
      repo: pr.repository.nameWithOwner,
    }));
  }

  async getUserIssues(username: string): Promise<IssueDetails[]> {
    const query = `
      query($username: String!) {
        user(login: $username) {
          issues(first: 100, orderBy: {field: CREATED_AT, direction: DESC}) {
            nodes {
              number
              title
              state
              createdAt
              closedAt
              url
              comments {
                totalCount
              }
              repository {
                nameWithOwner
              }
            }
          }
        }
      }
    `;

    const result: any = await this.graphqlClient(query, { username });
    return result.user.issues.nodes.map((issue: any) => ({
      number: issue.number,
      title: issue.title,
      state: issue.state.toLowerCase(),
      created_at: issue.createdAt,
      closed_at: issue.closedAt,
      html_url: issue.url,
      repo: issue.repository.nameWithOwner,
      comments: issue.comments.totalCount,
    }));
  }

  async getNotifications(): Promise<any[]> {
    const { data } = await this.octokit.activity.listNotificationsForAuthenticatedUser({
      all: false,
      participating: true,
    });
    return data;
  }

  async getStarredRepos(username: string): Promise<any[]> {
    const { data } = await this.octokit.activity.listReposStarredByUser({
      username,
      per_page: 100,
      sort: 'created',
    });
    return data;
  }

  async getWatchedRepos(username: string): Promise<any[]> {
    const { data } = await this.octokit.activity.listWatchedReposForAuthenticatedUser({
      per_page: 100,
    });
    return data;
  }
}