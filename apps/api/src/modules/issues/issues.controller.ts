import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { OrgRole } from '@rant/database';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { IssuesService } from './issues.service';
import { CreateIssueDto, ListIssuesQueryDto, UpdateIssueDto } from './dto/issue.dto';

@Controller('organizations/:orgId/workspaces/:workspaceId/projects/:projectId/issues')
export class IssuesController {
  constructor(private readonly issues: IssuesService) {}

  @Get()
  list(
    @Param('orgId') orgId: string,
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Query() query: ListIssuesQueryDto,
  ) {
    return this.issues.list({ orgId, workspaceId, projectId }, query);
  }

  @Roles(OrgRole.DEVELOPER, OrgRole.QA, OrgRole.MANAGER)
  @Post()
  create(
    @Param('orgId') orgId: string,
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateIssueDto,
  ) {
    return this.issues.create({ orgId, workspaceId, projectId }, userId, dto);
  }

  @Get(':issueId')
  get(
    @Param('orgId') orgId: string,
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('issueId') issueId: string,
  ) {
    return this.issues.findOne({ orgId, workspaceId, projectId }, issueId);
  }

  @Roles(OrgRole.DEVELOPER, OrgRole.QA, OrgRole.MANAGER)
  @Patch(':issueId')
  update(
    @Param('orgId') orgId: string,
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('issueId') issueId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: UpdateIssueDto,
  ) {
    return this.issues.update({ orgId, workspaceId, projectId }, issueId, userId, dto);
  }

  @Roles(OrgRole.DEVELOPER, OrgRole.MANAGER)
  @Delete(':issueId')
  remove(
    @Param('orgId') orgId: string,
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('issueId') issueId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.issues.remove({ orgId, workspaceId, projectId }, issueId, userId);
  }
}
