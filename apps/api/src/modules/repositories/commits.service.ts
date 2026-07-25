import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { AppEvent, CommitCreatedPayload } from '../../common/events/app-events';
import { RepositoriesService } from './repositories.service';
import { CreateCommitDto } from './dto/repository.dto';
import { generateSha, shortSha } from './git.util';

@Injectable()
export class CommitsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly repos: RepositoriesService,
    private readonly events: EventEmitter2,
  ) {}

  async list(orgId: string, repoId: string, branch?: string) {
    await this.repos.assertRepo(orgId, repoId);
    return this.prisma.commit.findMany({
      where: { repositoryId: repoId, branch },
      include: { author: { select: { id: true, name: true, avatarUrl: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async create(orgId: string, repoId: string, actorId: string, dto: CreateCommitDto) {
    await this.repos.assertRepo(orgId, repoId);
    const branch = await this.prisma.branch.findUnique({
      where: { repositoryId_name: { repositoryId: repoId, name: dto.branch } },
    });
    if (!branch) throw new BadRequestException(`Branch "${dto.branch}" does not exist`);

    const sha = generateSha();
    const [commit] = await this.prisma.$transaction([
      this.prisma.commit.create({
        data: {
          repositoryId: repoId,
          sha,
          message: dto.message,
          branch: dto.branch,
          parentSha: branch.headCommitSha,
          authorId: actorId,
        },
        include: { author: { select: { id: true, name: true, avatarUrl: true } } },
      }),
      this.prisma.branch.update({
        where: { id: branch.id },
        data: { headCommitSha: sha },
      }),
    ]);

    await this.audit.record({
      organizationId: orgId,
      actorId,
      action: 'commit.created',
      targetType: 'Commit',
      targetId: commit.id,
      metadata: { sha: shortSha(sha), branch: dto.branch },
    });

    // Ripple out: any pipeline watching this branch's pushes will start a run.
    const payload: CommitCreatedPayload = {
      orgId,
      repoId,
      branch: dto.branch,
      commitSha: sha,
      actorId,
    };
    this.events.emit(AppEvent.CommitCreated, payload);

    return commit;
  }

  async findOne(orgId: string, repoId: string, sha: string) {
    await this.repos.assertRepo(orgId, repoId);
    const commit = await this.prisma.commit.findFirst({
      where: { repositoryId: repoId, sha },
      include: { author: { select: { id: true, name: true, avatarUrl: true } } },
    });
    if (!commit) throw new NotFoundException('Commit not found');
    return commit;
  }
}
