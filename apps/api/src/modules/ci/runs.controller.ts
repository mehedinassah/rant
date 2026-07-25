import { Controller, Get, Param, Post, Sse } from '@nestjs/common';
import type { Observable } from 'rxjs';
import { OrgRole } from '@rant/database';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RunsService } from './runs.service';

@Controller('organizations/:orgId/repositories/:repoId/runs')
export class RunsController {
  constructor(private readonly runs: RunsService) {}

  @Get()
  list(@Param('orgId') orgId: string, @Param('repoId') repoId: string) {
    return this.runs.listForRepo(orgId, repoId);
  }

  @Get(':runId')
  get(
    @Param('orgId') orgId: string,
    @Param('repoId') repoId: string,
    @Param('runId') runId: string,
  ) {
    return this.runs.findRun(orgId, repoId, runId);
  }

  /** Server-Sent Events: streams run snapshots until it reaches a terminal state. */
  @Sse(':runId/stream')
  stream(
    @Param('orgId') orgId: string,
    @Param('repoId') repoId: string,
    @Param('runId') runId: string,
  ): Observable<MessageEvent> {
    return this.runs.stream(orgId, repoId, runId);
  }

  @Roles(OrgRole.DEVELOPER, OrgRole.DEVOPS, OrgRole.MANAGER)
  @Post(':runId/cancel')
  cancel(
    @Param('orgId') orgId: string,
    @Param('repoId') repoId: string,
    @Param('runId') runId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.runs.cancel(orgId, repoId, runId, userId);
  }
}
