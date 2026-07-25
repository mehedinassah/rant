import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { RepositoriesService } from './repositories.service';
import { CreateTagDto } from './dto/repository.dto';

@Injectable()
export class TagsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly repos: RepositoriesService,
  ) {}

  async list(orgId: string, repoId: string) {
    await this.repos.assertRepo(orgId, repoId);
    return this.prisma.tag.findMany({
      where: { repositoryId: repoId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(orgId: string, repoId: string, actorId: string, dto: CreateTagDto) {
    const repo = await this.repos.assertRepo(orgId, repoId);

    // Default to the tip of the default branch when no SHA is given.
    let commitSha = dto.commitSha;
    if (!commitSha) {
      const def = await this.prisma.branch.findUnique({
        where: { repositoryId_name: { repositoryId: repoId, name: repo.defaultBranch } },
      });
      if (!def?.headCommitSha) {
        throw new BadRequestException('No commits to tag; provide a commitSha or commit first');
      }
      commitSha = def.headCommitSha;
    } else {
      const commit = await this.prisma.commit.findFirst({
        where: { repositoryId: repoId, sha: commitSha },
        select: { id: true },
      });
      if (!commit) throw new BadRequestException('commitSha does not exist in this repository');
    }

    const clash = await this.prisma.tag.findUnique({
      where: { repositoryId_name: { repositoryId: repoId, name: dto.name } },
    });
    if (clash) throw new ConflictException('Tag already exists');

    const tag = await this.prisma.tag.create({
      data: { repositoryId: repoId, name: dto.name, commitSha },
    });
    await this.audit.record({
      organizationId: orgId,
      actorId,
      action: 'tag.created',
      targetType: 'Tag',
      targetId: tag.id,
      metadata: { name: tag.name },
    });
    return tag;
  }

  async remove(orgId: string, repoId: string, name: string, actorId: string) {
    await this.repos.assertRepo(orgId, repoId);
    const tag = await this.prisma.tag.findUnique({
      where: { repositoryId_name: { repositoryId: repoId, name } },
    });
    if (!tag) throw new NotFoundException('Tag not found');
    await this.prisma.tag.delete({ where: { id: tag.id } });
    await this.audit.record({
      organizationId: orgId,
      actorId,
      action: 'tag.deleted',
      targetType: 'Tag',
      targetId: tag.id,
      metadata: { name },
    });
    return { success: true };
  }
}
