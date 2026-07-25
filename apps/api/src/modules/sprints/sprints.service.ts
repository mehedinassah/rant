import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { ProjectsService } from '../projects/projects.service';
import { CreateSprintDto, UpdateSprintDto } from './dto/sprint.dto';

interface Scope {
  orgId: string;
  workspaceId: string;
  projectId: string;
}

@Injectable()
export class SprintsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly projects: ProjectsService,
  ) {}

  async list(scope: Scope) {
    await this.projects.assertInScope(scope.orgId, scope.workspaceId, scope.projectId);
    return this.prisma.sprint.findMany({
      where: { projectId: scope.projectId },
      include: { _count: { select: { issues: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(scope: Scope, actorId: string, dto: CreateSprintDto) {
    await this.projects.assertInScope(scope.orgId, scope.workspaceId, scope.projectId);
    const sprint = await this.prisma.sprint.create({
      data: {
        projectId: scope.projectId,
        name: dto.name,
        goal: dto.goal,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      },
    });
    await this.audit.record({
      organizationId: scope.orgId,
      actorId,
      action: 'sprint.created',
      targetType: 'Sprint',
      targetId: sprint.id,
      metadata: { name: sprint.name },
    });
    return sprint;
  }

  async findOne(scope: Scope, sprintId: string) {
    await this.projects.assertInScope(scope.orgId, scope.workspaceId, scope.projectId);
    const sprint = await this.prisma.sprint.findFirst({
      where: { id: sprintId, projectId: scope.projectId },
      include: { _count: { select: { issues: true } } },
    });
    if (!sprint) throw new NotFoundException('Sprint not found');
    return sprint;
  }

  async update(scope: Scope, sprintId: string, actorId: string, dto: UpdateSprintDto) {
    await this.findOne(scope, sprintId);
    const sprint = await this.prisma.sprint.update({
      where: { id: sprintId },
      data: {
        ...dto,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      },
    });
    await this.audit.record({
      organizationId: scope.orgId,
      actorId,
      action: 'sprint.updated',
      targetType: 'Sprint',
      targetId: sprintId,
      metadata: { ...dto },
    });
    return sprint;
  }

  async remove(scope: Scope, sprintId: string, actorId: string) {
    await this.findOne(scope, sprintId);
    await this.prisma.sprint.delete({ where: { id: sprintId } });
    await this.audit.record({
      organizationId: scope.orgId,
      actorId,
      action: 'sprint.deleted',
      targetType: 'Sprint',
      targetId: sprintId,
    });
    return { success: true };
  }
}
