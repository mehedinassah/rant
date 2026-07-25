import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { OrgRole } from '@rant/database';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { EnvironmentsService } from './environments.service';
import { DeploymentsService } from './deployments.service';
import {
  CreateEnvironmentDto,
  DeployDto,
  RollbackDto,
  UpdateEnvironmentDto,
} from './dto/deployment.dto';

@Controller('organizations/:orgId/repositories/:repoId/environments')
export class EnvironmentsController {
  constructor(
    private readonly environments: EnvironmentsService,
    private readonly deployments: DeploymentsService,
  ) {}

  @Get()
  list(@Param('orgId') orgId: string, @Param('repoId') repoId: string) {
    return this.environments.list(orgId, repoId);
  }

  @Roles(OrgRole.DEVOPS, OrgRole.MANAGER)
  @Post()
  create(
    @Param('orgId') orgId: string,
    @Param('repoId') repoId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateEnvironmentDto,
  ) {
    return this.environments.create(orgId, repoId, userId, dto);
  }

  @Roles(OrgRole.DEVOPS, OrgRole.MANAGER)
  @Patch(':envId')
  update(
    @Param('orgId') orgId: string,
    @Param('repoId') repoId: string,
    @Param('envId') envId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: UpdateEnvironmentDto,
  ) {
    return this.environments.update(orgId, repoId, envId, userId, dto);
  }

  @Roles(OrgRole.DEVOPS, OrgRole.MANAGER)
  @Delete(':envId')
  remove(
    @Param('orgId') orgId: string,
    @Param('repoId') repoId: string,
    @Param('envId') envId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.environments.remove(orgId, repoId, envId, userId);
  }

  /** Manually deploy a branch head to this environment. */
  @Roles(OrgRole.DEVOPS, OrgRole.MANAGER)
  @Post(':envId/deploy')
  deploy(
    @Param('orgId') orgId: string,
    @Param('repoId') repoId: string,
    @Param('envId') envId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: DeployDto,
  ) {
    return this.deployments.deployManual(orgId, repoId, envId, userId, dto.branch);
  }

  /** Roll an environment back to a prior successful deployment. */
  @Roles(OrgRole.DEVOPS, OrgRole.MANAGER)
  @Post(':envId/rollback')
  rollback(
    @Param('orgId') orgId: string,
    @Param('repoId') repoId: string,
    @Param('envId') envId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: RollbackDto,
  ) {
    return this.deployments.rollback(orgId, repoId, envId, userId, dto.deploymentId);
  }
}
