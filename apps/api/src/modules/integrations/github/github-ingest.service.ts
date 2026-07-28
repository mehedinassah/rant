import { Injectable, Logger } from '@nestjs/common';
import { RecordSource, RepositoryVisibility } from '@rant/database';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { GithubUserMapper } from './github-user.mapper';
import {
  toPipelineTrigger,
  toPullRequestStatus,
  toReviewState,
  toRunStatus,
} from './github.mappers';

// Minimal shapes of the GitHub payload fields we consume (avoids a hard SDK dep).
interface GhRepo { id: number; name: string; full_name?: string; private?: boolean; default_branch?: string }
interface GhActor { id?: number; login?: string; avatar_url?: string }
interface GhCommit { id?: string; sha?: string; message: string; author?: { username?: string; name?: string } }
interface GhPull {
  id: number; number: number; title: string; body?: string | null;
  head?: { ref?: string }; base?: { ref?: string };
  state?: string; draft?: boolean; merged?: boolean; merged_at?: string | null;
  merge_commit_sha?: string | null; user?: GhActor; merged_by?: GhActor | null;
}
interface GhReview { id: number; state: string; body?: string | null; user?: GhActor; submitted_at?: string }
interface GhWorkflowRun {
  id: number; name?: string; run_number: number; event?: string;
  status?: string; conclusion?: string | null; head_branch?: string;
  head_sha?: string; actor?: GhActor; run_started_at?: string; updated_at?: string;
}

/**
 * Turns GitHub payloads into rant rows. Pure persistence — it never emits bus
 * events, so the realtime processor (G4) and the historical backfill (G5) can
 * share it: the processor emits ripples for fresh events, backfill stays silent.
 */
@Injectable()
export class GithubIngestService {
  private readonly logger = new Logger('GithubIngest');

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: GithubUserMapper,
  ) {}

  async orgIdForInstallation(installationId: number | string): Promise<string | null> {
    const inst = await this.prisma.githubInstallation.findUnique({
      where: { installationId: BigInt(installationId) },
      select: { organizationId: true, suspendedAt: true },
    });
    if (!inst || inst.suspendedAt) return null;
    return inst.organizationId;
  }

  async upsertRepository(orgId: string, repo: GhRepo): Promise<{ id: string }> {
    const externalId = String(repo.id);
    const visibility = repo.private === false ? RepositoryVisibility.PUBLIC : RepositoryVisibility.PRIVATE;
    return this.prisma.repository.upsert({
      where: { organizationId_externalId: { organizationId: orgId, externalId } },
      create: {
        organizationId: orgId,
        name: repo.name,
        slug: this.slugify(repo.name),
        defaultBranch: repo.default_branch ?? 'main',
        visibility,
        source: RecordSource.GITHUB,
        externalId,
      },
      update: { name: repo.name, defaultBranch: repo.default_branch ?? undefined, visibility },
      select: { id: true },
    });
  }

  /** Inserts any commits not already stored; returns the newly created ones. */
  async ingestCommits(
    repoId: string,
    branch: string,
    commits: GhCommit[],
  ): Promise<{ sha: string; message: string }[]> {
    const created: { sha: string; message: string }[] = [];
    for (const c of commits) {
      const sha = c.sha ?? c.id;
      if (!sha) continue;
      const exists = await this.prisma.commit.findUnique({
        where: { repositoryId_sha: { repositoryId: repoId, sha } },
        select: { id: true },
      });
      if (exists) continue;
      const authorId = await this.users.resolveUserId({
        login: c.author?.username ?? undefined,
      });
      await this.prisma.commit.create({
        data: {
          repositoryId: repoId,
          sha,
          message: c.message,
          branch,
          authorId,
          source: RecordSource.GITHUB,
          externalId: sha,
        },
      });
      created.push({ sha, message: c.message });
    }
    return created;
  }

  async upsertPullRequest(
    repoId: string,
    action: string,
    pr: GhPull,
  ): Promise<{ id: string; number: number; created: boolean; isOpen: boolean }> {
    const externalId = String(pr.id);
    const status = toPullRequestStatus(action, pr);
    const authorId = await this.users.resolveUserId(pr.user);
    const mergedById = pr.merged_by ? await this.users.resolveUserId(pr.merged_by) : null;

    const existing = await this.prisma.pullRequest.findUnique({
      where: { repositoryId_number: { repositoryId: repoId, number: pr.number } },
      select: { id: true },
    });

    const data = {
      title: pr.title,
      description: pr.body ?? null,
      sourceBranch: pr.head?.ref ?? 'unknown',
      targetBranch: pr.base?.ref ?? 'main',
      status,
      mergedById,
      mergeCommitSha: pr.merge_commit_sha ?? null,
      mergedAt: pr.merged_at ? new Date(pr.merged_at) : null,
    };

    if (existing) {
      await this.prisma.pullRequest.update({ where: { id: existing.id }, data });
      return { id: existing.id, number: pr.number, created: false, isOpen: status === 'OPEN' };
    }
    const row = await this.prisma.pullRequest.create({
      data: {
        repositoryId: repoId,
        number: pr.number,
        authorId,
        source: RecordSource.GITHUB,
        externalId,
        ...data,
      },
      select: { id: true },
    });
    return { id: row.id, number: pr.number, created: true, isOpen: status === 'OPEN' };
  }

  async upsertReview(pullRequestId: string, review: GhReview): Promise<void> {
    const externalId = String(review.id);
    const reviewerId = await this.users.resolveUserId(review.user);
    await this.prisma.review.upsert({
      where: { pullRequestId_externalId: { pullRequestId, externalId } },
      create: {
        pullRequestId,
        reviewerId,
        state: toReviewState(review.state),
        body: review.body ?? null,
        source: RecordSource.GITHUB,
        externalId,
      },
      update: { state: toReviewState(review.state), body: review.body ?? null },
    });
  }

  async upsertWorkflowRun(
    repoId: string,
    run: GhWorkflowRun,
  ): Promise<{ runId: string; pipelineId: string; status: string; branch: string; commitSha: string | null }> {
    const pipelineName = run.name ?? 'workflow';
    const pipeline = await this.prisma.pipeline.upsert({
      where: { repositoryId_name: { repositoryId: repoId, name: pipelineName } },
      create: { repositoryId: repoId, name: pipelineName, definition: {}, isActive: true },
      update: {},
      select: { id: true },
    });

    const externalId = String(run.id);
    const status = toRunStatus(run.conclusion ?? null, run.status);
    const triggeredById = await this.users.resolveUserId(run.actor);
    const branch = run.head_branch ?? 'main';
    const commitSha = run.head_sha ?? null;

    const runRow = await this.prisma.pipelineRun.upsert({
      where: { pipelineId_externalId: { pipelineId: pipeline.id, externalId } },
      create: {
        pipelineId: pipeline.id,
        number: run.run_number,
        status,
        trigger: toPipelineTrigger(run.event),
        branch,
        commitSha,
        triggeredById,
        source: 'GITHUB',
        externalId,
        startedAt: run.run_started_at ? new Date(run.run_started_at) : null,
        finishedAt: run.status === 'completed' && run.updated_at ? new Date(run.updated_at) : null,
      },
      update: {
        status,
        finishedAt: run.status === 'completed' && run.updated_at ? new Date(run.updated_at) : null,
      },
      select: { id: true },
    });

    return { runId: runRow.id, pipelineId: pipeline.id, status, branch, commitSha };
  }

  private slugify(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'repo';
  }
}
