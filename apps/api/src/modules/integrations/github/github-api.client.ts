import { Injectable, Logger } from '@nestjs/common';
import { GithubAuthService } from './github-auth.service';
import {
  GITHUB_ACCEPT,
  GITHUB_API_BASE,
  GITHUB_API_VERSION,
  GITHUB_USER_AGENT,
} from './github.constants';

export interface GhRepoSummary {
  id: number;
  name: string;
  full_name: string;
  owner: { login: string };
  private: boolean;
  default_branch: string;
}

/**
 * Thin REST client for the GitHub API using installation tokens. Kept minimal
 * (fetch + the handful of endpoints backfill needs) to avoid the ESM Octokit
 * SDK. Honors GitHub's primary rate limit with a single reactive backoff.
 */
@Injectable()
export class GithubApiClient {
  private readonly logger = new Logger('GithubApi');

  constructor(private readonly auth: GithubAuthService) {}

  private async get<T>(installationId: string | number, path: string): Promise<T> {
    const token = await this.auth.getInstallationToken(installationId);
    const res = await fetch(`${GITHUB_API_BASE}${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: GITHUB_ACCEPT,
        'X-GitHub-Api-Version': GITHUB_API_VERSION,
        'User-Agent': GITHUB_USER_AGENT,
      },
    });

    // Reactive backoff on secondary/primary rate limit, then one retry.
    if (res.status === 403 && res.headers.get('x-ratelimit-remaining') === '0') {
      const resetMs = Number(res.headers.get('x-ratelimit-reset') ?? 0) * 1000;
      const waitMs = Math.min(Math.max(resetMs - Date.now(), 1000), 60_000);
      this.logger.warn(`Rate limited; backing off ${waitMs}ms`);
      await new Promise((r) => setTimeout(r, waitMs));
      return this.get<T>(installationId, path);
    }
    if (!res.ok) {
      throw new Error(`GitHub GET ${path} failed: ${res.status}`);
    }
    return (await res.json()) as T;
  }

  listInstallationRepos(installationId: string | number): Promise<GhRepoSummary[]> {
    return this.get<{ repositories: GhRepoSummary[] }>(
      installationId,
      '/installation/repositories?per_page=100',
    ).then((r) => r.repositories ?? []);
  }

  listCommits(installationId: string | number, owner: string, repo: string, branch: string) {
    return this.get<
      { sha: string; commit: { message: string }; author?: { login?: string } }[]
    >(installationId, `/repos/${owner}/${repo}/commits?sha=${encodeURIComponent(branch)}&per_page=30`);
  }

  listOpenPulls(installationId: string | number, owner: string, repo: string) {
    return this.get<Record<string, unknown>[]>(
      installationId,
      `/repos/${owner}/${repo}/pulls?state=all&per_page=30&sort=updated&direction=desc`,
    );
  }

  listWorkflowRuns(installationId: string | number, owner: string, repo: string) {
    return this.get<{ workflow_runs: Record<string, unknown>[] }>(
      installationId,
      `/repos/${owner}/${repo}/actions/runs?per_page=20`,
    ).then((r) => r.workflow_runs ?? []);
  }
}
