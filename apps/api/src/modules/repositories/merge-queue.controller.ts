import { Controller, Get, Param, Post } from '@nestjs/common';
import { OrgRole } from '@rant/database';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PullRequestsService } from './pull-requests.service';

@Controller('organizations/:orgId/repositories/:repoId/merge-queue')
export class MergeQueueController {
  constructor(private readonly pulls: PullRequestsService) {}

  @Get()
  list(@Param('orgId') orgId: string, @Param('repoId') repoId: string) {
    return this.pulls.listQueue(orgId, repoId);
  }

  @Roles(OrgRole.DEVOPS, OrgRole.MANAGER)
  @Post('process')
  process(
    @Param('orgId') orgId: string,
    @Param('repoId') repoId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.pulls.processQueue(orgId, repoId, userId);
  }
}
