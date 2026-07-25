import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { OrgRole } from '@rant/database';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { ProjectsService } from '../projects/projects.service';
import { CreateCommentDto } from './dto/issue.dto';

interface Scope {
  orgId: string;
  workspaceId: string;
  projectId: string;
}

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly projects: ProjectsService,
  ) {}

  private async assertIssue(scope: Scope, issueId: string): Promise<void> {
    await this.projects.assertInScope(scope.orgId, scope.workspaceId, scope.projectId);
    const issue = await this.prisma.issue.findFirst({
      where: { id: issueId, projectId: scope.projectId },
      select: { id: true },
    });
    if (!issue) throw new NotFoundException('Issue not found');
  }

  async list(scope: Scope, issueId: string) {
    await this.assertIssue(scope, issueId);
    return this.prisma.comment.findMany({
      where: { issueId },
      include: { author: { select: { id: true, name: true, avatarUrl: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(scope: Scope, issueId: string, authorId: string, dto: CreateCommentDto) {
    await this.assertIssue(scope, issueId);
    const comment = await this.prisma.comment.create({
      data: { issueId, authorId, body: dto.body },
      include: { author: { select: { id: true, name: true, avatarUrl: true } } },
    });
    await this.audit.record({
      organizationId: scope.orgId,
      actorId: authorId,
      action: 'comment.created',
      targetType: 'Comment',
      targetId: comment.id,
      metadata: { issueId },
    });
    return comment;
  }

  /** Author can delete their own comment; MANAGER+ can delete any. */
  async remove(
    scope: Scope,
    issueId: string,
    commentId: string,
    actor: { userId: string; role: OrgRole },
  ) {
    await this.assertIssue(scope, issueId);
    const comment = await this.prisma.comment.findFirst({
      where: { id: commentId, issueId },
    });
    if (!comment) throw new NotFoundException('Comment not found');

    const privileged: OrgRole[] = [OrgRole.OWNER, OrgRole.ADMIN, OrgRole.MANAGER];
    const isPrivileged = privileged.includes(actor.role);
    if (comment.authorId !== actor.userId && !isPrivileged) {
      throw new ForbiddenException('You can only delete your own comments');
    }

    await this.prisma.comment.delete({ where: { id: commentId } });
    await this.audit.record({
      organizationId: scope.orgId,
      actorId: actor.userId,
      action: 'comment.deleted',
      targetType: 'Comment',
      targetId: commentId,
    });
    return { success: true };
  }
}
