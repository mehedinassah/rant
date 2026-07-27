import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { RepositoriesController } from './repositories.controller';
import { RepositoriesService } from './repositories.service';
import { BranchesController } from './branches.controller';
import { BranchesService } from './branches.service';
import { CommitsController } from './commits.controller';
import { CommitsService } from './commits.service';
import { TagsController } from './tags.controller';
import { TagsService } from './tags.service';
import { ReleasesController } from './releases.controller';
import { ReleasesService } from './releases.service';
import { PullRequestsController } from './pull-requests.controller';
import { PullRequestsService } from './pull-requests.service';
import { MergeQueueController } from './merge-queue.controller';

@Module({
  imports: [BillingModule],
  controllers: [
    RepositoriesController,
    BranchesController,
    CommitsController,
    TagsController,
    ReleasesController,
    PullRequestsController,
    MergeQueueController,
  ],
  providers: [
    RepositoriesService,
    BranchesService,
    CommitsService,
    TagsService,
    ReleasesService,
    PullRequestsService,
  ],
  exports: [RepositoriesService],
})
export class RepositoriesModule {}
