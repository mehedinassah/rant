import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PullRequestStatus, ReviewState, RunStatus } from '@rant/database';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { AppEvent, PullRequestOpenedPayload } from '../../common/events/app-events';
import { RepositoriesService } from './repositories.service';
import {
  CreatePullRequestDto,
  CreateReviewDto,
  UpdatePullRequestDto,
} from './dto/repository.dto';
import { generateSha, shortSha } from './git.util';

const PR_INCLUDE = {
  author: { select: { id: true, name: true, avatarUrl: true } },
  mergedBy: { select: { id: true, name: true, avatarUrl: true } },
  _count: { select: { reviews: true } },
};

@Injectable()
export class PullRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly repos: RepositoriesService,
    private readonly events: EventEmitter2,
  ) {}

  private async findPr(repoId: string, number: number) {
    const pr = await this.prisma.pullRequest.findUnique({
      where: { repositoryId_number: { repositoryId: repoId, number } },
    });
    if (!pr) throw new NotFoundException('Pull request not found');
    return pr;
  }

  private async assertBranch(repoId: string, name: string): Promise<void> {
    const branch = await this.prisma.branch.findUnique({
      where: { repositoryId_name: { repositoryId: repoId, name } },
    });
    if (!branch) throw new BadRequestException(`Branch "${name}" does not exist`);
  }

  async list(orgId: string, repoId: string, status?: PullRequestStatus) {
    await this.repos.assertRepo(orgId, repoId);
    return this.prisma.pullRequest.findMany({
      where: { repositoryId: repoId, status },
      include: PR_INCLUDE,
      orderBy: { number: 'desc' },
    });
  }

  async create(orgId: string, repoId: string, actorId: string, dto: CreatePullRequestDto) {
    const repo = await this.repos.assertRepo(orgId, repoId);
    const targetBranch = dto.targetBranch ?? repo.defaultBranch;
    if (dto.sourceBranch === targetBranch) {
      throw new BadRequestException('sourceBranch and targetBranch must differ');
    }
    await this.assertBranch(repoId, dto.sourceBranch);
    await this.assertBranch(repoId, targetBranch);

    // Atomically mint the next PR number.
    const updated = await this.prisma.repository.update({
      where: { id: repoId },
      data: { pullRequestCounter: { increment: 1 } },
      select: { pullRequestCounter: true },
    });

    const pr = await this.prisma.pullRequest.create({
      data: {
        repositoryId: repoId,
        number: updated.pullRequestCounter,
        title: dto.title,
        description: dto.description,
        sourceBranch: dto.sourceBranch,
        targetBranch,
        authorId: actorId,
      },
      include: PR_INCLUDE,
    });

    await this.audit.record({
      organizationId: orgId,
      actorId,
      action: 'pull_request.opened',
      targetType: 'PullRequest',
      targetId: pr.id,
      metadata: { number: pr.number, title: pr.title },
    });

    // Ripple out: kick off any PR-triggered CI checks for the source branch.
    const payload: PullRequestOpenedPayload = {
      orgId,
      repoId,
      pullRequestId: pr.id,
      prNumber: pr.number,
      branch: pr.sourceBranch,
      actorId,
    };
    this.events.emit(AppEvent.PullRequestOpened, payload);

    return pr;
  }

  async findOne(orgId: string, repoId: string, number: number) {
    await this.repos.assertRepo(orgId, repoId);
    const pr = await this.prisma.pullRequest.findUnique({
      where: { repositoryId_number: { repositoryId: repoId, number } },
      include: {
        ...PR_INCLUDE,
        reviews: {
          include: { reviewer: { select: { id: true, name: true, avatarUrl: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!pr) throw new NotFoundException('Pull request not found');
    return pr;
  }

  async update(
    orgId: string,
    repoId: string,
    number: number,
    actorId: string,
    dto: UpdatePullRequestDto,
  ) {
    await this.repos.assertRepo(orgId, repoId);
    const pr = await this.findPr(repoId, number);
    if (pr.status === PullRequestStatus.MERGED) {
      throw new BadRequestException('Cannot modify a merged pull request');
    }
    if (dto.status === PullRequestStatus.MERGED) {
      throw new BadRequestException('Use the merge endpoint to merge a pull request');
    }

    const updated = await this.prisma.pullRequest.update({
      where: { id: pr.id },
      data: { title: dto.title, description: dto.description, status: dto.status },
      include: PR_INCLUDE,
    });
    await this.audit.record({
      organizationId: orgId,
      actorId,
      action: 'pull_request.updated',
      targetType: 'PullRequest',
      targetId: pr.id,
      metadata: { number, ...dto },
    });
    return updated;
  }

  // ── Reviews ───────────────────────────────────────────────

  async listReviews(orgId: string, repoId: string, number: number) {
    await this.repos.assertRepo(orgId, repoId);
    const pr = await this.findPr(repoId, number);
    return this.prisma.review.findMany({
      where: { pullRequestId: pr.id },
      include: { reviewer: { select: { id: true, name: true, avatarUrl: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addReview(
    orgId: string,
    repoId: string,
    number: number,
    reviewerId: string,
    dto: CreateReviewDto,
  ) {
    await this.repos.assertRepo(orgId, repoId);
    const pr = await this.findPr(repoId, number);
    if (pr.status === PullRequestStatus.MERGED || pr.status === PullRequestStatus.CLOSED) {
      throw new BadRequestException('Cannot review a closed or merged pull request');
    }
    if (pr.authorId === reviewerId) {
      throw new BadRequestException('You cannot review your own pull request');
    }

    const review = await this.prisma.review.create({
      data: { pullRequestId: pr.id, reviewerId, state: dto.state, body: dto.body },
      include: { reviewer: { select: { id: true, name: true, avatarUrl: true } } },
    });
    await this.audit.record({
      organizationId: orgId,
      actorId: reviewerId,
      action: 'pull_request.reviewed',
      targetType: 'PullRequest',
      targetId: pr.id,
      metadata: { number, state: dto.state },
    });
    return review;
  }

  /** Latest review state per reviewer; used for the merge gate. */
  private async reviewGate(prId: string): Promise<{ approvals: number; blocked: boolean }> {
    const reviews = await this.prisma.review.findMany({
      where: { pullRequestId: prId },
      orderBy: { createdAt: 'asc' },
    });
    const latest = new Map<string, ReviewState>();
    for (const r of reviews) latest.set(r.reviewerId, r.state);
    const states = [...latest.values()];
    return {
      approvals: states.filter((s) => s === ReviewState.APPROVED).length,
      blocked: states.some((s) => s === ReviewState.CHANGES_REQUESTED),
    };
  }

  /** CI gate: the newest pipeline run for this PR must have succeeded. A PR with
   *  no runs is allowed through (repos without pipelines behave as before). */
  private async checksGate(prId: string): Promise<{ ok: true } | { ok: false; reason: string }> {
    const latest = await this.prisma.pipelineRun.findFirst({
      where: { pullRequestId: prId },
      orderBy: { createdAt: 'desc' },
      select: { status: true },
    });
    if (!latest || latest.status === RunStatus.SUCCESS) return { ok: true };
    if (latest.status === RunStatus.FAILED) {
      return { ok: false, reason: 'Merge blocked: CI checks are failing' };
    }
    return { ok: false, reason: 'Merge blocked: CI checks are still running' };
  }

  // ── Merge ─────────────────────────────────────────────────

  async merge(orgId: string, repoId: string, number: number, actorId: string) {
    await this.repos.assertRepo(orgId, repoId);
    const pr = await this.findPr(repoId, number);
    const result = await this.doMerge(orgId, repoId, pr.id, actorId);
    if (!result.ok) throw new ConflictException(result.reason);
    return result.pr;
  }

  /** Shared merge routine used by both direct merge and the queue processor. */
  private async doMerge(orgId: string, repoId: string, prId: string, actorId: string) {
    const pr = await this.prisma.pullRequest.findUniqueOrThrow({ where: { id: prId } });
    if (pr.status !== PullRequestStatus.OPEN) {
      return { ok: false as const, reason: `Pull request is ${pr.status.toLowerCase()}, not open` };
    }
    const gate = await this.reviewGate(pr.id);
    if (gate.blocked) {
      return { ok: false as const, reason: 'Merge blocked: changes requested by a reviewer' };
    }

    // CI gate: the latest pipeline run for this PR must be green.
    const check = await this.checksGate(pr.id);
    if (!check.ok) {
      return { ok: false as const, reason: check.reason };
    }

    const target = await this.prisma.branch.findUnique({
      where: { repositoryId_name: { repositoryId: repoId, name: pr.targetBranch } },
    });
    if (!target) {
      return { ok: false as const, reason: 'Target branch no longer exists' };
    }

    const mergeSha = generateSha();
    const merged = await this.prisma.$transaction(async (tx) => {
      await tx.commit.create({
        data: {
          repositoryId: repoId,
          sha: mergeSha,
          message: `Merge pull request #${pr.number}: ${pr.title}`,
          branch: pr.targetBranch,
          parentSha: target.headCommitSha,
          authorId: actorId,
        },
      });
      await tx.branch.update({ where: { id: target.id }, data: { headCommitSha: mergeSha } });
      return tx.pullRequest.update({
        where: { id: pr.id },
        data: {
          status: PullRequestStatus.MERGED,
          mergedAt: new Date(),
          mergedById: actorId,
          mergeCommitSha: mergeSha,
          mergeQueuedAt: null,
        },
        include: PR_INCLUDE,
      });
    });

    await this.audit.record({
      organizationId: orgId,
      actorId,
      action: 'pull_request.merged',
      targetType: 'PullRequest',
      targetId: pr.id,
      metadata: { number: pr.number, mergeCommit: shortSha(mergeSha) },
    });

    return { ok: true as const, pr: merged };
  }

  // ── Merge queue ───────────────────────────────────────────

  async enqueue(orgId: string, repoId: string, number: number, actorId: string) {
    await this.repos.assertRepo(orgId, repoId);
    const pr = await this.findPr(repoId, number);
    if (pr.status !== PullRequestStatus.OPEN) {
      throw new BadRequestException('Only open pull requests can be queued');
    }
    const updated = await this.prisma.pullRequest.update({
      where: { id: pr.id },
      data: { mergeQueuedAt: pr.mergeQueuedAt ?? new Date() },
      include: PR_INCLUDE,
    });
    await this.audit.record({
      organizationId: orgId,
      actorId,
      action: 'pull_request.enqueued',
      targetType: 'PullRequest',
      targetId: pr.id,
      metadata: { number },
    });
    return updated;
  }

  async dequeue(orgId: string, repoId: string, number: number) {
    await this.repos.assertRepo(orgId, repoId);
    const pr = await this.findPr(repoId, number);
    return this.prisma.pullRequest.update({
      where: { id: pr.id },
      data: { mergeQueuedAt: null },
      include: PR_INCLUDE,
    });
  }

  async listQueue(orgId: string, repoId: string) {
    await this.repos.assertRepo(orgId, repoId);
    return this.prisma.pullRequest.findMany({
      where: { repositoryId: repoId, status: PullRequestStatus.OPEN, mergeQueuedAt: { not: null } },
      include: PR_INCLUDE,
      orderBy: { mergeQueuedAt: 'asc' },
    });
  }

  /** Processes the queue in order, merging each mergeable PR and stopping at
   *  the first that is blocked (mirroring a real merge queue). */
  async processQueue(orgId: string, repoId: string, actorId: string) {
    await this.repos.assertRepo(orgId, repoId);
    const queue = await this.prisma.pullRequest.findMany({
      where: { repositoryId: repoId, status: PullRequestStatus.OPEN, mergeQueuedAt: { not: null } },
      orderBy: { mergeQueuedAt: 'asc' },
    });

    const merged: number[] = [];
    let blocked: { number: number; reason: string } | null = null;
    for (const pr of queue) {
      const result = await this.doMerge(orgId, repoId, pr.id, actorId);
      if (result.ok) {
        merged.push(pr.number);
      } else {
        blocked = { number: pr.number, reason: result.reason };
        break;
      }
    }
    return { merged, blocked };
  }
}
