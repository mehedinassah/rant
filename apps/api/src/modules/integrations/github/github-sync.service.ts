import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { GithubApiClient } from './github-api.client';
import { GithubIngestService } from './github-ingest.service';

/**
 * Backfills an installation's repos, recent commits, PRs and workflow runs into
 * rant. Reuses the ingest service (idempotent upserts) but deliberately does NOT
 * emit bus events — importing history should not open incidents or spam chat.
 */
@Injectable()
export class GithubSyncService {
  private readonly logger = new Logger('GithubSync');

  constructor(
    private readonly prisma: PrismaService,
    private readonly api: GithubApiClient,
    private readonly ingest: GithubIngestService,
  ) {}

  async syncInstallation(installationId: string | number): Promise<{ repos: number }> {
    const orgId = await this.ingest.orgIdForInstallation(installationId);
    if (!orgId) {
      this.logger.warn(`No active org for installation ${installationId}; skipping sync`);
      return { repos: 0 };
    }

    const repos = await this.api.listInstallationRepos(installationId);
    for (const repo of repos) {
      try {
        await this.syncRepo(installationId, orgId, repo);
      } catch (err) {
        this.logger.error(`Sync failed for ${repo.full_name}: ${(err as Error).message}`);
      }
    }

    await this.prisma.githubInstallation.update({
      where: { installationId: BigInt(installationId) },
      data: { syncedAt: new Date() },
    });
    this.logger.log(`Synced ${repos.length} repo(s) for org ${orgId}`);
    return { repos: repos.length };
  }

  private async syncRepo(
    installationId: string | number,
    orgId: string,
    repo: { id: number; name: string; full_name: string; owner: { login: string }; private: boolean; default_branch: string },
  ): Promise<void> {
    const { id: repoId } = await this.ingest.upsertRepository(orgId, repo);
    const owner = repo.owner.login;

    const commits = await this.api.listCommits(installationId, owner, repo.name, repo.default_branch);
    await this.ingest.ingestCommits(
      repoId,
      repo.default_branch,
      commits.map((c) => ({ sha: c.sha, message: c.commit?.message ?? '', author: { username: c.author?.login } })),
    );

    const pulls = await this.api.listOpenPulls(installationId, owner, repo.name);
    for (const pr of pulls) {
      await this.ingest.upsertPullRequest(repoId, 'synced', pr as never);
    }

    const runs = await this.api.listWorkflowRuns(installationId, owner, repo.name);
    for (const run of runs) {
      await this.ingest.upsertWorkflowRun(repoId, run as never);
    }
  }
}
