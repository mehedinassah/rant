import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { OrgRole } from '@rant/database';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ProjectsService } from './projects.service';
import { CreateProjectDto, UpdateProjectDto } from './dto/project.dto';

@Controller('organizations/:orgId/workspaces/:workspaceId/projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  list(@Param('orgId') orgId: string, @Param('workspaceId') workspaceId: string) {
    return this.projects.list(orgId, workspaceId);
  }

  @Roles(OrgRole.DEVELOPER, OrgRole.MANAGER)
  @Post()
  create(
    @Param('orgId') orgId: string,
    @Param('workspaceId') workspaceId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateProjectDto,
  ) {
    return this.projects.create(orgId, workspaceId, userId, dto);
  }

  @Get(':projectId')
  get(
    @Param('orgId') orgId: string,
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
  ) {
    return this.projects.findOne(orgId, workspaceId, projectId);
  }

  @Roles(OrgRole.DEVELOPER, OrgRole.MANAGER)
  @Patch(':projectId')
  update(
    @Param('orgId') orgId: string,
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projects.update(orgId, workspaceId, projectId, userId, dto);
  }

  @Roles(OrgRole.MANAGER)
  @Delete(':projectId')
  remove(
    @Param('orgId') orgId: string,
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.projects.remove(orgId, workspaceId, projectId, userId);
  }
}
