import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { RepositoriesService } from './repositories.service';
import { CreateReleaseDto } from './dto/repository.dto';

@Injectable()
export class ReleasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly repos: RepositoriesService,
  ) {}

  async list(orgId: string, repoId: string) {
    await this.repos.assertRepo(orgId, repoId);
    return this.prisma.release.findMany({
      where: { repositoryId: repoId },
      include: { author: { select: { id: true, name: true, avatarUrl: true } } },
      orderBy: { publishedAt: 'desc' },
    });
  }

  async create(orgId: string, repoId: string, actorId: string, dto: CreateReleaseDto) {
    const repo = await this.repos.assertRepo(orgId, repoId);

    // Auto-create the tag at the default branch tip if it doesn't exist yet.
    let tag = await this.prisma.tag.findUnique({
      where: { repositoryId_name: { repositoryId: repoId, name: dto.tagName } },
    });
    if (!tag) {
      const def = await this.prisma.branch.findUnique({
        where: { repositoryId_name: { repositoryId: repoId, name: repo.defaultBranch } },
      });
      if (!def?.headCommitSha) {
        throw new BadRequestException('Cannot create release: no commits to tag');
      }
      tag = await this.prisma.tag.create({
        data: { repositoryId: repoId, name: dto.tagName, commitSha: def.headCommitSha },
      });
    }

    const clash = await this.prisma.release.findUnique({
      where: { repositoryId_tagName: { repositoryId: repoId, tagName: dto.tagName } },
    });
    if (clash) throw new ConflictException('A release already exists for this tag');

    const release = await this.prisma.release.create({
      data: {
        repositoryId: repoId,
        tagName: dto.tagName,
        name: dto.name,
        body: dto.body,
        isPrerelease: dto.isPrerelease ?? false,
        authorId: actorId,
      },
      include: { author: { select: { id: true, name: true, avatarUrl: true } } },
    });

    await this.audit.record({
      organizationId: orgId,
      actorId,
      action: 'release.published',
      targetType: 'Release',
      targetId: release.id,
      metadata: { tag: release.tagName, name: release.name },
    });

    return release;
  }

  async remove(orgId: string, repoId: string, releaseId: string, actorId: string) {
    await this.repos.assertRepo(orgId, repoId);
    const release = await this.prisma.release.findFirst({
      where: { id: releaseId, repositoryId: repoId },
    });
    if (!release) throw new NotFoundException('Release not found');
    await this.prisma.release.delete({ where: { id: releaseId } });
    await this.audit.record({
      organizationId: orgId,
      actorId,
      action: 'release.deleted',
      targetType: 'Release',
      targetId: releaseId,
    });
    return { success: true };
  }
}
