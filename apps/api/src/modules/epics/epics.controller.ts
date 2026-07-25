import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { OrgRole } from '@rant/database';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { EpicsService } from './epics.service';
import { CreateEpicDto, UpdateEpicDto } from './dto/epic.dto';

@Controller('organizations/:orgId/workspaces/:workspaceId/projects/:projectId/epics')
export class EpicsController {
  constructor(private readonly epics: EpicsService) {}

  @Get()
  list(
    @Param('orgId') orgId: string,
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
  ) {
    return this.epics.list({ orgId, workspaceId, projectId });
  }

  @Roles(OrgRole.DEVELOPER, OrgRole.MANAGER)
  @Post()
  create(
    @Param('orgId') orgId: string,
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateEpicDto,
  ) {
    return this.epics.create({ orgId, workspaceId, projectId }, userId, dto);
  }

  @Get(':epicId')
  get(
    @Param('orgId') orgId: string,
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('epicId') epicId: string,
  ) {
    return this.epics.findOne({ orgId, workspaceId, projectId }, epicId);
  }

  @Roles(OrgRole.DEVELOPER, OrgRole.MANAGER)
  @Patch(':epicId')
  update(
    @Param('orgId') orgId: string,
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('epicId') epicId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: UpdateEpicDto,
  ) {
    return this.epics.update({ orgId, workspaceId, projectId }, epicId, userId, dto);
  }

  @Roles(OrgRole.MANAGER)
  @Delete(':epicId')
  remove(
    @Param('orgId') orgId: string,
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('epicId') epicId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.epics.remove({ orgId, workspaceId, projectId }, epicId, userId);
  }
}
