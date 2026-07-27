import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { BillingService } from '../billing/billing.service';
import { CreateProjectDto, UpdateProjectDto } from './dto/project.dto';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly billing: BillingService,
  ) {}

  /** Confirms the workspace belongs to the org before any project operation. */
  private async assertWorkspace(orgId: string, workspaceId: string): Promise<void> {
    const workspace = await this.prisma.workspace.findFirst({
      where: { id: workspaceId, organizationId: orgId },
      select: { id: true },
    });
    if (!workspace) throw new NotFoundException('Workspace not found');
  }

  /**
   * Verifies the full org → workspace → project chain and returns the project.
   * Shared by the sprint/epic/issue modules to keep RBAC + scoping consistent.
   */
  async assertInScope(orgId: string, workspaceId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, workspaceId, workspace: { organizationId: orgId } },
    });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  async list(orgId: string, workspaceId: string) {
    await this.assertWorkspace(orgId, workspaceId);
    return this.prisma.project.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(orgId: string, workspaceId: string, actorId: string, dto: CreateProjectDto) {
    await this.assertWorkspace(orgId, workspaceId);
    await this.billing.assertWithinLimit(orgId, 'projects');

    const clash = await this.prisma.project.findUnique({
      where: { workspaceId_key: { workspaceId, key: dto.key } },
    });
    if (clash) throw new ConflictException(`Project key "${dto.key}" already used in this workspace`);

    const project = await this.prisma.project.create({
      data: {
        workspaceId,
        name: dto.name,
        key: dto.key,
        description: dto.description,
        visibility: dto.visibility,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        targetDate: dto.targetDate ? new Date(dto.targetDate) : undefined,
      },
    });

    await this.audit.record({
      organizationId: orgId,
      actorId,
      action: 'project.created',
      targetType: 'Project',
      targetId: project.id,
      metadata: { key: project.key },
    });

    return project;
  }

  async findOne(orgId: string, workspaceId: string, projectId: string) {
    await this.assertWorkspace(orgId, workspaceId);
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, workspaceId },
    });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  async update(
    orgId: string,
    workspaceId: string,
    projectId: string,
    actorId: string,
    dto: UpdateProjectDto,
  ) {
    await this.findOne(orgId, workspaceId, projectId);
    const project = await this.prisma.project.update({
      where: { id: projectId },
      data: {
        ...dto,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        targetDate: dto.targetDate ? new Date(dto.targetDate) : undefined,
      },
    });
    await this.audit.record({
      organizationId: orgId,
      actorId,
      action: 'project.updated',
      targetType: 'Project',
      targetId: projectId,
      metadata: { ...dto },
    });
    return project;
  }

  async remove(orgId: string, workspaceId: string, projectId: string, actorId: string) {
    await this.findOne(orgId, workspaceId, projectId);
    await this.prisma.project.delete({ where: { id: projectId } });
    await this.audit.record({
      organizationId: orgId,
      actorId,
      action: 'project.deleted',
      targetType: 'Project',
      targetId: projectId,
    });
    return { success: true };
  }
}
