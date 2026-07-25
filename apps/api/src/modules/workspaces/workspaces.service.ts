import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { CreateWorkspaceDto, UpdateWorkspaceDto } from './dto/workspace.dto';

@Injectable()
export class WorkspacesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list(orgId: string) {
    return this.prisma.workspace.findMany({
      where: { organizationId: orgId },
      include: { _count: { select: { projects: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(orgId: string, actorId: string, dto: CreateWorkspaceDto) {
    const clash = await this.prisma.workspace.findUnique({
      where: { organizationId_slug: { organizationId: orgId, slug: dto.slug } },
    });
    if (clash) throw new ConflictException('Workspace slug already used in this organization');

    const workspace = await this.prisma.workspace.create({
      data: { organizationId: orgId, name: dto.name, slug: dto.slug, description: dto.description },
    });

    await this.audit.record({
      organizationId: orgId,
      actorId,
      action: 'workspace.created',
      targetType: 'Workspace',
      targetId: workspace.id,
      metadata: { slug: workspace.slug },
    });

    return workspace;
  }

  async findOne(orgId: string, workspaceId: string) {
    const workspace = await this.prisma.workspace.findFirst({
      where: { id: workspaceId, organizationId: orgId },
      include: { _count: { select: { projects: true } } },
    });
    if (!workspace) throw new NotFoundException('Workspace not found');
    return workspace;
  }

  async update(orgId: string, workspaceId: string, actorId: string, dto: UpdateWorkspaceDto) {
    await this.findOne(orgId, workspaceId);
    const workspace = await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: dto,
    });
    await this.audit.record({
      organizationId: orgId,
      actorId,
      action: 'workspace.updated',
      targetType: 'Workspace',
      targetId: workspaceId,
      metadata: { ...dto },
    });
    return workspace;
  }

  async remove(orgId: string, workspaceId: string, actorId: string) {
    await this.findOne(orgId, workspaceId);
    await this.prisma.workspace.delete({ where: { id: workspaceId } });
    await this.audit.record({
      organizationId: orgId,
      actorId,
      action: 'workspace.deleted',
      targetType: 'Workspace',
      targetId: workspaceId,
    });
    return { success: true };
  }
}
