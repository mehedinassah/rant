import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { OrgRole } from '@rant/database';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { SprintsService } from './sprints.service';
import { CreateSprintDto, UpdateSprintDto } from './dto/sprint.dto';

@Controller('organizations/:orgId/workspaces/:workspaceId/projects/:projectId/sprints')
export class SprintsController {
  constructor(private readonly sprints: SprintsService) {}

  @Get()
  list(
    @Param('orgId') orgId: string,
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
  ) {
    return this.sprints.list({ orgId, workspaceId, projectId });
  }

  @Roles(OrgRole.DEVELOPER, OrgRole.MANAGER)
  @Post()
  create(
    @Param('orgId') orgId: string,
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateSprintDto,
  ) {
    return this.sprints.create({ orgId, workspaceId, projectId }, userId, dto);
  }

  @Get(':sprintId')
  get(
    @Param('orgId') orgId: string,
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('sprintId') sprintId: string,
  ) {
    return this.sprints.findOne({ orgId, workspaceId, projectId }, sprintId);
  }

  @Roles(OrgRole.DEVELOPER, OrgRole.MANAGER)
  @Patch(':sprintId')
  update(
    @Param('orgId') orgId: string,
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('sprintId') sprintId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: UpdateSprintDto,
  ) {
    return this.sprints.update({ orgId, workspaceId, projectId }, sprintId, userId, dto);
  }

  @Roles(OrgRole.MANAGER)
  @Delete(':sprintId')
  remove(
    @Param('orgId') orgId: string,
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('sprintId') sprintId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.sprints.remove({ orgId, workspaceId, projectId }, sprintId, userId);
  }
}
