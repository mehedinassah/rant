import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { OrgRole } from '@rant/database';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CommitsService } from './commits.service';
import { CreateCommitDto } from './dto/repository.dto';

@Controller('organizations/:orgId/repositories/:repoId/commits')
export class CommitsController {
  constructor(private readonly commits: CommitsService) {}

  @Get()
  list(
    @Param('orgId') orgId: string,
    @Param('repoId') repoId: string,
    @Query('branch') branch?: string,
  ) {
    return this.commits.list(orgId, repoId, branch);
  }

  @Roles(OrgRole.DEVELOPER, OrgRole.DEVOPS, OrgRole.MANAGER)
  @Post()
  create(
    @Param('orgId') orgId: string,
    @Param('repoId') repoId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateCommitDto,
  ) {
    return this.commits.create(orgId, repoId, userId, dto);
  }

  @Get(':sha')
  get(
    @Param('orgId') orgId: string,
    @Param('repoId') repoId: string,
    @Param('sha') sha: string,
  ) {
    return this.commits.findOne(orgId, repoId, sha);
  }
}
