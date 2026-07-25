import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import type { OrganizationMembership } from '@rant/database';
import { OrgRole } from '@rant/database';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentMembership } from '../../common/decorators/current-membership.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/issue.dto';

@Controller(
  'organizations/:orgId/workspaces/:workspaceId/projects/:projectId/issues/:issueId/comments',
)
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Get()
  list(
    @Param('orgId') orgId: string,
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('issueId') issueId: string,
  ) {
    return this.comments.list({ orgId, workspaceId, projectId }, issueId);
  }

  @Roles(OrgRole.DEVELOPER, OrgRole.QA, OrgRole.DEVOPS, OrgRole.MANAGER)
  @Post()
  create(
    @Param('orgId') orgId: string,
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('issueId') issueId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.comments.create({ orgId, workspaceId, projectId }, issueId, userId, dto);
  }

  @Delete(':commentId')
  remove(
    @Param('orgId') orgId: string,
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('issueId') issueId: string,
    @Param('commentId') commentId: string,
    @CurrentMembership() membership: OrganizationMembership,
  ) {
    return this.comments.remove({ orgId, workspaceId, projectId }, issueId, commentId, {
      userId: membership.userId,
      role: membership.role,
    });
  }
}
