import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { OrgRole } from '@rant/database';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ReleasesService } from './releases.service';
import { CreateReleaseDto } from './dto/repository.dto';

@Controller('organizations/:orgId/repositories/:repoId/releases')
export class ReleasesController {
  constructor(private readonly releases: ReleasesService) {}

  @Get()
  list(@Param('orgId') orgId: string, @Param('repoId') repoId: string) {
    return this.releases.list(orgId, repoId);
  }

  @Roles(OrgRole.DEVELOPER, OrgRole.DEVOPS, OrgRole.MANAGER)
  @Post()
  create(
    @Param('orgId') orgId: string,
    @Param('repoId') repoId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateReleaseDto,
  ) {
    return this.releases.create(orgId, repoId, userId, dto);
  }

  @Roles(OrgRole.DEVOPS, OrgRole.MANAGER)
  @Delete(':releaseId')
  remove(
    @Param('orgId') orgId: string,
    @Param('repoId') repoId: string,
    @Param('releaseId') releaseId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.releases.remove(orgId, repoId, releaseId, userId);
  }
}
