import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { OrgRole } from '@rant/database';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RepositoriesService } from './repositories.service';
import { CreateRepositoryDto, UpdateRepositoryDto } from './dto/repository.dto';

@Controller('organizations/:orgId/repositories')
export class RepositoriesController {
  constructor(private readonly repositories: RepositoriesService) {}

  @Get()
  list(@Param('orgId') orgId: string) {
    return this.repositories.list(orgId);
  }

  @Roles(OrgRole.DEVELOPER, OrgRole.DEVOPS, OrgRole.MANAGER)
  @Post()
  create(
    @Param('orgId') orgId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateRepositoryDto,
  ) {
    return this.repositories.create(orgId, userId, dto);
  }

  @Get(':repoId')
  get(@Param('orgId') orgId: string, @Param('repoId') repoId: string) {
    return this.repositories.findOne(orgId, repoId);
  }

  @Roles(OrgRole.DEVOPS, OrgRole.MANAGER)
  @Patch(':repoId')
  update(
    @Param('orgId') orgId: string,
    @Param('repoId') repoId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: UpdateRepositoryDto,
  ) {
    return this.repositories.update(orgId, repoId, userId, dto);
  }

  @Roles(OrgRole.MANAGER)
  @Delete(':repoId')
  remove(
    @Param('orgId') orgId: string,
    @Param('repoId') repoId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.repositories.remove(orgId, repoId, userId);
  }
}
