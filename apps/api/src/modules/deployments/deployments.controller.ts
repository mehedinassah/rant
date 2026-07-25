import { Controller, Get, Param, Post, Sse } from '@nestjs/common';
import type { Observable } from 'rxjs';
import { OrgRole } from '@rant/database';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { DeploymentsService } from './deployments.service';

@Controller('organizations/:orgId/repositories/:repoId/deployments')
export class DeploymentsController {
  constructor(private readonly deployments: DeploymentsService) {}

  @Get()
  list(@Param('orgId') orgId: string, @Param('repoId') repoId: string) {
    return this.deployments.listForRepo(orgId, repoId);
  }

  @Get(':deploymentId')
  get(
    @Param('orgId') orgId: string,
    @Param('repoId') repoId: string,
    @Param('deploymentId') deploymentId: string,
  ) {
    return this.deployments.findDeployment(orgId, repoId, deploymentId);
  }

  /** Server-Sent Events: streams deployment snapshots until terminal. */
  @Sse(':deploymentId/stream')
  stream(
    @Param('orgId') orgId: string,
    @Param('repoId') repoId: string,
    @Param('deploymentId') deploymentId: string,
  ): Observable<MessageEvent> {
    return this.deployments.stream(orgId, repoId, deploymentId);
  }

  @Roles(OrgRole.DEVOPS, OrgRole.MANAGER)
  @Post(':deploymentId/cancel')
  cancel(
    @Param('orgId') orgId: string,
    @Param('repoId') repoId: string,
    @Param('deploymentId') deploymentId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.deployments.cancel(orgId, repoId, deploymentId, userId);
  }
}
