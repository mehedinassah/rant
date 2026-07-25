import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Environment } from '@rant/database';
import { EnvironmentType } from '@rant/database';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { RepositoriesService } from '../repositories/repositories.service';
import { CreateEnvironmentDto, UpdateEnvironmentDto } from './dto/deployment.dto';

const CURRENT_DEPLOYMENT_SELECT = {
  select: {
    id: true,
    number: true,
    status: true,
    url: true,
    branch: true,
    commitSha: true,
    createdAt: true,
  },
};

@Injectable()
export class EnvironmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly repos: RepositoriesService,
  ) {}

  async assertEnv(orgId: string, repoId: string, envId: string): Promise<Environment> {
    await this.repos.assertRepo(orgId, repoId);
    const env = await this.prisma.environment.findFirst({
      where: { id: envId, repositoryId: repoId },
    });
    if (!env) throw new NotFoundException('Environment not found');
    return env;
  }

  async list(orgId: string, repoId: string) {
    await this.repos.assertRepo(orgId, repoId);
    return this.prisma.environment.findMany({
      where: { repositoryId: repoId },
      include: {
        currentDeployment: CURRENT_DEPLOYMENT_SELECT,
        _count: { select: { deployments: true } },
      },
      orderBy: [{ isProduction: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async create(orgId: string, repoId: string, actorId: string, dto: CreateEnvironmentDto) {
    await this.repos.assertRepo(orgId, repoId);
    const clash = await this.prisma.environment.findUnique({
      where: { repositoryId_slug: { repositoryId: repoId, slug: dto.slug } },
    });
    if (clash) throw new ConflictException('An environment with that slug already exists');

    const type = dto.type ?? EnvironmentType.PREVIEW;
    const env = await this.prisma.environment.create({
      data: {
        repositoryId: repoId,
        name: dto.name,
        slug: dto.slug,
        type,
        isProduction: type === EnvironmentType.PRODUCTION,
        branchFilter: dto.branchFilter,
      },
    });
    await this.audit.record({
      organizationId: orgId,
      actorId,
      action: 'environment.created',
      targetType: 'Environment',
      targetId: env.id,
      metadata: { slug: env.slug, type },
    });
    return env;
  }

  async update(
    orgId: string,
    repoId: string,
    envId: string,
    actorId: string,
    dto: UpdateEnvironmentDto,
  ) {
    await this.assertEnv(orgId, repoId, envId);
    const env = await this.prisma.environment.update({
      where: { id: envId },
      data: { name: dto.name, branchFilter: dto.branchFilter },
    });
    await this.audit.record({
      organizationId: orgId,
      actorId,
      action: 'environment.updated',
      targetType: 'Environment',
      targetId: envId,
      metadata: { ...dto },
    });
    return env;
  }

  async remove(orgId: string, repoId: string, envId: string, actorId: string) {
    const env = await this.assertEnv(orgId, repoId, envId);
    if (env.isProduction) {
      throw new ConflictException('The production environment cannot be deleted');
    }
    await this.prisma.environment.delete({ where: { id: envId } });
    await this.audit.record({
      organizationId: orgId,
      actorId,
      action: 'environment.deleted',
      targetType: 'Environment',
      targetId: envId,
    });
    return { success: true };
  }
}
