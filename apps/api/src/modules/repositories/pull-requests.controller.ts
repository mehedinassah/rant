import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { OrgRole } from '@rant/database';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PullRequestsService } from './pull-requests.service';
import {
  CreatePullRequestDto,
  CreateReviewDto,
  ListPullRequestsQueryDto,
  UpdatePullRequestDto,
} from './dto/repository.dto';

@Controller('organizations/:orgId/repositories/:repoId/pulls')
export class PullRequestsController {
  constructor(private readonly pulls: PullRequestsService) {}

  @Get()
  list(
    @Param('orgId') orgId: string,
    @Param('repoId') repoId: string,
    @Query() query: ListPullRequestsQueryDto,
  ) {
    return this.pulls.list(orgId, repoId, query.status);
  }

  @Roles(OrgRole.DEVELOPER, OrgRole.QA, OrgRole.DEVOPS, OrgRole.MANAGER)
  @Post()
  create(
    @Param('orgId') orgId: string,
    @Param('repoId') repoId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: CreatePullRequestDto,
  ) {
    return this.pulls.create(orgId, repoId, userId, dto);
  }

  @Get(':number')
  get(
    @Param('orgId') orgId: string,
    @Param('repoId') repoId: string,
    @Param('number', ParseIntPipe) number: number,
  ) {
    return this.pulls.findOne(orgId, repoId, number);
  }

  @Roles(OrgRole.DEVELOPER, OrgRole.QA, OrgRole.DEVOPS, OrgRole.MANAGER)
  @Patch(':number')
  update(
    @Param('orgId') orgId: string,
    @Param('repoId') repoId: string,
    @Param('number', ParseIntPipe) number: number,
    @CurrentUser('userId') userId: string,
    @Body() dto: UpdatePullRequestDto,
  ) {
    return this.pulls.update(orgId, repoId, number, userId, dto);
  }

  // ── Reviews ───────────────────────────────────────────────

  @Get(':number/reviews')
  listReviews(
    @Param('orgId') orgId: string,
    @Param('repoId') repoId: string,
    @Param('number', ParseIntPipe) number: number,
  ) {
    return this.pulls.listReviews(orgId, repoId, number);
  }

  @Roles(OrgRole.DEVELOPER, OrgRole.QA, OrgRole.DEVOPS, OrgRole.MANAGER)
  @Post(':number/reviews')
  addReview(
    @Param('orgId') orgId: string,
    @Param('repoId') repoId: string,
    @Param('number', ParseIntPipe) number: number,
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateReviewDto,
  ) {
    return this.pulls.addReview(orgId, repoId, number, userId, dto);
  }

  // ── Merge + queue ─────────────────────────────────────────

  @Roles(OrgRole.DEVOPS, OrgRole.MANAGER)
  @Post(':number/merge')
  merge(
    @Param('orgId') orgId: string,
    @Param('repoId') repoId: string,
    @Param('number', ParseIntPipe) number: number,
    @CurrentUser('userId') userId: string,
  ) {
    return this.pulls.merge(orgId, repoId, number, userId);
  }

  @Roles(OrgRole.DEVELOPER, OrgRole.DEVOPS, OrgRole.MANAGER)
  @Post(':number/queue')
  enqueue(
    @Param('orgId') orgId: string,
    @Param('repoId') repoId: string,
    @Param('number', ParseIntPipe) number: number,
    @CurrentUser('userId') userId: string,
  ) {
    return this.pulls.enqueue(orgId, repoId, number, userId);
  }

  @Roles(OrgRole.DEVELOPER, OrgRole.DEVOPS, OrgRole.MANAGER)
  @Delete(':number/queue')
  dequeue(
    @Param('orgId') orgId: string,
    @Param('repoId') repoId: string,
    @Param('number', ParseIntPipe) number: number,
  ) {
    return this.pulls.dequeue(orgId, repoId, number);
  }
}
