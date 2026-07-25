import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { ProjectsService } from '../projects/projects.service';
import { CreateEpicDto, UpdateEpicDto } from './dto/epic.dto';

interface Scope {
  orgId: string;
  workspaceId: string;
  projectId: string;
}

@Injectable()
export class EpicsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly projects: ProjectsService,
  ) {}

  async list(scope: Scope) {
    await this.projects.assertInScope(scope.orgId, scope.workspaceId, scope.projectId);
    return this.prisma.epic.findMany({
      where: { projectId: scope.projectId },
      include: { _count: { select: { issues: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(scope: Scope, actorId: string, dto: CreateEpicDto) {
    await this.projects.assertInScope(scope.orgId, scope.workspaceId, scope.projectId);
    const epic = await this.prisma.epic.create({
      data: {
        projectId: scope.projectId,
        name: dto.name,
        description: dto.description,
        color: dto.color,
      },
    });
    await this.audit.record({
      organizationId: scope.orgId,
      actorId,
      action: 'epic.created',
      targetType: 'Epic',
      targetId: epic.id,
      metadata: { name: epic.name },
    });
    return epic;
  }

  async findOne(scope: Scope, epicId: string) {
    await this.projects.assertInScope(scope.orgId, scope.workspaceId, scope.projectId);
    const epic = await this.prisma.epic.findFirst({
      where: { id: epicId, projectId: scope.projectId },
      include: { _count: { select: { issues: true } } },
    });
    if (!epic) throw new NotFoundException('Epic not found');
    return epic;
  }

  async update(scope: Scope, epicId: string, actorId: string, dto: UpdateEpicDto) {
    await this.findOne(scope, epicId);
    const epic = await this.prisma.epic.update({ where: { id: epicId }, data: dto });
    await this.audit.record({
      organizationId: scope.orgId,
      actorId,
      action: 'epic.updated',
      targetType: 'Epic',
      targetId: epicId,
      metadata: { ...dto },
    });
    return epic;
  }

  async remove(scope: Scope, epicId: string, actorId: string) {
    await this.findOne(scope, epicId);
    await this.prisma.epic.delete({ where: { id: epicId } });
    await this.audit.record({
      organizationId: scope.orgId,
      actorId,
      action: 'epic.deleted',
      targetType: 'Epic',
      targetId: epicId,
    });
    return { success: true };
  }
}
