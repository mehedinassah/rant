import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Pipeline, Prisma } from '@rant/database';
import { PipelineTrigger } from '@rant/database';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { RepositoriesService } from '../repositories/repositories.service';
import { CreatePipelineDto, UpdatePipelineDto } from './dto/ci.dto';
import { DEFAULT_DEFINITION } from './ci.constants';

@Injectable()
export class PipelinesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly repos: RepositoriesService,
  ) {}

  /** Loads a pipeline and confirms it belongs to the repo/org (404 otherwise). */
  async assertPipeline(orgId: string, repoId: string, pipelineId: string): Promise<Pipeline> {
    await this.repos.assertRepo(orgId, repoId);
    const pipeline = await this.prisma.pipeline.findFirst({
      where: { id: pipelineId, repositoryId: repoId },
    });
    if (!pipeline) throw new NotFoundException('Pipeline not found');
    return pipeline;
  }

  async list(orgId: string, repoId: string) {
    await this.repos.assertRepo(orgId, repoId);
    return this.prisma.pipeline.findMany({
      where: { repositoryId: repoId },
      include: { _count: { select: { runs: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(orgId: string, repoId: string, actorId: string, dto: CreatePipelineDto) {
    await this.repos.assertRepo(orgId, repoId);
    const clash = await this.prisma.pipeline.findUnique({
      where: { repositoryId_name: { repositoryId: repoId, name: dto.name } },
    });
    if (clash) throw new ConflictException('A pipeline with that name already exists in this repo');

    const pipeline = await this.prisma.pipeline.create({
      data: {
        repositoryId: repoId,
        name: dto.name,
        definition: (dto.definition ?? DEFAULT_DEFINITION) as unknown as Prisma.InputJsonValue,
        triggers: dto.triggers ?? [PipelineTrigger.PUSH, PipelineTrigger.PULL_REQUEST],
        branchFilter: dto.branchFilter,
      },
    });

    await this.audit.record({
      organizationId: orgId,
      actorId,
      action: 'pipeline.created',
      targetType: 'Pipeline',
      targetId: pipeline.id,
      metadata: { name: pipeline.name, triggers: pipeline.triggers },
    });

    return pipeline;
  }

  async findOne(orgId: string, repoId: string, pipelineId: string) {
    await this.assertPipeline(orgId, repoId, pipelineId);
    return this.prisma.pipeline.findUnique({
      where: { id: pipelineId },
      include: {
        runs: {
          take: 10,
          orderBy: { number: 'desc' },
          select: { id: true, number: true, status: true, trigger: true, branch: true, createdAt: true },
        },
        _count: { select: { runs: true } },
      },
    });
  }

  async update(
    orgId: string,
    repoId: string,
    pipelineId: string,
    actorId: string,
    dto: UpdatePipelineDto,
  ) {
    await this.assertPipeline(orgId, repoId, pipelineId);
    const pipeline = await this.prisma.pipeline.update({
      where: { id: pipelineId },
      data: {
        name: dto.name,
        definition: dto.definition as unknown as Prisma.InputJsonValue | undefined,
        triggers: dto.triggers,
        branchFilter: dto.branchFilter,
        isActive: dto.isActive,
      },
    });
    await this.audit.record({
      organizationId: orgId,
      actorId,
      action: 'pipeline.updated',
      targetType: 'Pipeline',
      targetId: pipelineId,
      metadata: { name: dto.name, triggers: dto.triggers, isActive: dto.isActive } as Prisma.InputJsonValue,
    });
    return pipeline;
  }

  async remove(orgId: string, repoId: string, pipelineId: string, actorId: string) {
    await this.assertPipeline(orgId, repoId, pipelineId);
    await this.prisma.pipeline.delete({ where: { id: pipelineId } });
    await this.audit.record({
      organizationId: orgId,
      actorId,
      action: 'pipeline.deleted',
      targetType: 'Pipeline',
      targetId: pipelineId,
    });
    return { success: true };
  }
}
