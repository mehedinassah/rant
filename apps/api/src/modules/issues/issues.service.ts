import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { MembershipStatus, Prisma } from '@rant/database';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { ProjectsService } from '../projects/projects.service';
import { CreateIssueDto, ListIssuesQueryDto, UpdateIssueDto } from './dto/issue.dto';

interface Scope {
  orgId: string;
  workspaceId: string;
  projectId: string;
}

const ISSUE_INCLUDE = {
  epic: { select: { id: true, name: true, color: true } },
  sprint: { select: { id: true, name: true, status: true } },
  assignee: { select: { id: true, name: true, avatarUrl: true } },
  reporter: { select: { id: true, name: true, avatarUrl: true } },
  _count: { select: { comments: true, children: true } },
} satisfies Prisma.IssueInclude;

@Injectable()
export class IssuesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly projects: ProjectsService,
  ) {}

  async list(scope: Scope, query: ListIssuesQueryDto) {
    await this.projects.assertInScope(scope.orgId, scope.workspaceId, scope.projectId);
    return this.prisma.issue.findMany({
      where: {
        projectId: scope.projectId,
        status: query.status,
        type: query.type,
        sprintId: query.sprintId,
        epicId: query.epicId,
        assigneeId: query.assigneeId,
      },
      include: ISSUE_INCLUDE,
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async create(scope: Scope, reporterId: string, dto: CreateIssueDto) {
    await this.projects.assertInScope(scope.orgId, scope.workspaceId, scope.projectId);
    await this.validateRefs(scope, dto.epicId, dto.sprintId, dto.parentId, dto.assigneeId);

    // Atomically mint the next per-project issue number.
    const project = await this.prisma.project.update({
      where: { id: scope.projectId },
      data: { issueCounter: { increment: 1 } },
      select: { issueCounter: true, key: true },
    });

    const issue = await this.prisma.issue.create({
      data: {
        projectId: scope.projectId,
        number: project.issueCounter,
        title: dto.title,
        description: dto.description,
        type: dto.type,
        priority: dto.priority,
        storyPoints: dto.storyPoints,
        epicId: dto.epicId,
        sprintId: dto.sprintId,
        parentId: dto.parentId,
        assigneeId: dto.assigneeId,
        reporterId,
      },
      include: ISSUE_INCLUDE,
    });

    await this.audit.record({
      organizationId: scope.orgId,
      actorId: reporterId,
      action: 'issue.created',
      targetType: 'Issue',
      targetId: issue.id,
      metadata: { ref: `${project.key}-${issue.number}`, title: issue.title },
    });

    return { ...issue, ref: `${project.key}-${issue.number}` };
  }

  async findOne(scope: Scope, issueId: string) {
    await this.projects.assertInScope(scope.orgId, scope.workspaceId, scope.projectId);
    const issue = await this.prisma.issue.findFirst({
      where: { id: issueId, projectId: scope.projectId },
      include: {
        ...ISSUE_INCLUDE,
        children: { include: ISSUE_INCLUDE, orderBy: { number: 'asc' } },
        comments: {
          include: { author: { select: { id: true, name: true, avatarUrl: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!issue) throw new NotFoundException('Issue not found');
    return issue;
  }

  async update(scope: Scope, issueId: string, actorId: string, dto: UpdateIssueDto) {
    await this.findOne(scope, issueId);
    await this.validateRefs(
      scope,
      dto.epicId ?? undefined,
      dto.sprintId ?? undefined,
      undefined,
      dto.assigneeId ?? undefined,
    );

    const issue = await this.prisma.issue.update({
      where: { id: issueId },
      data: {
        title: dto.title,
        description: dto.description,
        type: dto.type,
        status: dto.status,
        priority: dto.priority,
        storyPoints: dto.storyPoints,
        // null explicitly clears the relation; undefined leaves it untouched.
        epicId: dto.epicId,
        sprintId: dto.sprintId,
        assigneeId: dto.assigneeId,
      },
      include: ISSUE_INCLUDE,
    });

    await this.audit.record({
      organizationId: scope.orgId,
      actorId,
      action: 'issue.updated',
      targetType: 'Issue',
      targetId: issueId,
      metadata: { ...dto },
    });

    return issue;
  }

  async remove(scope: Scope, issueId: string, actorId: string) {
    await this.findOne(scope, issueId);
    await this.prisma.issue.delete({ where: { id: issueId } });
    await this.audit.record({
      organizationId: scope.orgId,
      actorId,
      action: 'issue.deleted',
      targetType: 'Issue',
      targetId: issueId,
    });
    return { success: true };
  }

  /** Ensures referenced epic/sprint/parent belong to the project and the
   *  assignee is an active member of the organization. */
  private async validateRefs(
    scope: Scope,
    epicId?: string,
    sprintId?: string,
    parentId?: string,
    assigneeId?: string,
  ): Promise<void> {
    if (epicId) {
      const epic = await this.prisma.epic.findFirst({
        where: { id: epicId, projectId: scope.projectId },
        select: { id: true },
      });
      if (!epic) throw new BadRequestException('epicId does not belong to this project');
    }
    if (sprintId) {
      const sprint = await this.prisma.sprint.findFirst({
        where: { id: sprintId, projectId: scope.projectId },
        select: { id: true },
      });
      if (!sprint) throw new BadRequestException('sprintId does not belong to this project');
    }
    if (parentId) {
      const parent = await this.prisma.issue.findFirst({
        where: { id: parentId, projectId: scope.projectId },
        select: { id: true },
      });
      if (!parent) throw new BadRequestException('parentId does not belong to this project');
    }
    if (assigneeId) {
      const member = await this.prisma.organizationMembership.findUnique({
        where: { organizationId_userId: { organizationId: scope.orgId, userId: assigneeId } },
        select: { status: true },
      });
      if (!member || member.status !== MembershipStatus.ACTIVE) {
        throw new BadRequestException('assignee must be an active member of the organization');
      }
    }
  }
}
