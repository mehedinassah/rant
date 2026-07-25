import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { OrgRole } from '@rant/database';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { WorkspacesService } from './workspaces.service';
import { CreateWorkspaceDto, UpdateWorkspaceDto } from './dto/workspace.dto';

@Controller('organizations/:orgId/workspaces')
export class WorkspacesController {
  constructor(private readonly workspaces: WorkspacesService) {}

  @Get()
  list(@Param('orgId') orgId: string) {
    return this.workspaces.list(orgId);
  }

  @Roles(OrgRole.MANAGER)
  @Post()
  create(
    @Param('orgId') orgId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateWorkspaceDto,
  ) {
    return this.workspaces.create(orgId, userId, dto);
  }

  @Get(':workspaceId')
  get(@Param('orgId') orgId: string, @Param('workspaceId') workspaceId: string) {
    return this.workspaces.findOne(orgId, workspaceId);
  }

  @Roles(OrgRole.MANAGER)
  @Patch(':workspaceId')
  update(
    @Param('orgId') orgId: string,
    @Param('workspaceId') workspaceId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: UpdateWorkspaceDto,
  ) {
    return this.workspaces.update(orgId, workspaceId, userId, dto);
  }

  @Roles(OrgRole.MANAGER)
  @Delete(':workspaceId')
  remove(
    @Param('orgId') orgId: string,
    @Param('workspaceId') workspaceId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.workspaces.remove(orgId, workspaceId, userId);
  }
}
