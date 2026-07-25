import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Repository } from '@rant/database';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { CreateRepositoryDto, UpdateRepositoryDto } from './dto/repository.dto';

@Injectable()
export class RepositoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Loads a repo and confirms it belongs to the org (404 otherwise). */
  async assertRepo(orgId: string, repoId: string): Promise<Repository> {
    const repo = await this.prisma.repository.findFirst({
      where: { id: repoId, organizationId: orgId },
    });
    if (!repo) throw new NotFoundException('Repository not found');
    return repo;
  }

  list(orgId: string) {
    return this.prisma.repository.findMany({
      where: { organizationId: orgId },
      include: {
        project: { select: { id: true, key: true, name: true } },
        _count: { select: { branches: true, pullRequests: true, commits: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async create(orgId: string, actorId: string, dto: CreateRepositoryDto) {
    const clash = await this.prisma.repository.findUnique({
      where: { organizationId_slug: { organizationId: orgId, slug: dto.slug } },
    });
    if (clash) throw new ConflictException('Repository slug already used in this organization');

    if (dto.projectId) {
      const project = await this.prisma.project.findFirst({
        where: { id: dto.projectId, workspace: { organizationId: orgId } },
        select: { id: true },
      });
      if (!project) throw new BadRequestException('projectId does not belong to this organization');
    }

    const defaultBranch = dto.defaultBranch ?? 'main';

    // Create the repo, its (empty) default branch, and a Production
    // environment (which auto-deploys successful runs on the default branch).
    const repo = await this.prisma.repository.create({
      data: {
        organizationId: orgId,
        projectId: dto.projectId,
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        visibility: dto.visibility,
        defaultBranch,
        branches: { create: { name: defaultBranch, isDefault: true } },
        environments: {
          create: {
            name: 'Production',
            slug: 'production',
            type: 'PRODUCTION',
            isProduction: true,
            branchFilter: defaultBranch,
          },
        },
      },
    });

    await this.audit.record({
      organizationId: orgId,
      actorId,
      action: 'repository.created',
      targetType: 'Repository',
      targetId: repo.id,
      metadata: { slug: repo.slug },
    });

    return repo;
  }

  async findOne(orgId: string, repoId: string) {
    await this.assertRepo(orgId, repoId);
    return this.prisma.repository.findUnique({
      where: { id: repoId },
      include: {
        project: { select: { id: true, key: true, name: true } },
        _count: {
          select: { branches: true, commits: true, tags: true, releases: true, pullRequests: true },
        },
      },
    });
  }

  async update(orgId: string, repoId: string, actorId: string, dto: UpdateRepositoryDto) {
    await this.assertRepo(orgId, repoId);
    if (dto.defaultBranch) {
      const branch = await this.prisma.branch.findUnique({
        where: { repositoryId_name: { repositoryId: repoId, name: dto.defaultBranch } },
      });
      if (!branch) throw new BadRequestException('defaultBranch must be an existing branch');
    }
    const repo = await this.prisma.repository.update({ where: { id: repoId }, data: dto });
    await this.audit.record({
      organizationId: orgId,
      actorId,
      action: 'repository.updated',
      targetType: 'Repository',
      targetId: repoId,
      metadata: { ...dto },
    });
    return repo;
  }

  async remove(orgId: string, repoId: string, actorId: string) {
    await this.assertRepo(orgId, repoId);
    await this.prisma.repository.delete({ where: { id: repoId } });
    await this.audit.record({
      organizationId: orgId,
      actorId,
      action: 'repository.deleted',
      targetType: 'Repository',
      targetId: repoId,
    });
    return { success: true };
  }
}
