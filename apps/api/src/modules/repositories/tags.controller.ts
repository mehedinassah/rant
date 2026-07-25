import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { OrgRole } from '@rant/database';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { TagsService } from './tags.service';
import { CreateTagDto } from './dto/repository.dto';

@Controller('organizations/:orgId/repositories/:repoId/tags')
export class TagsController {
  constructor(private readonly tags: TagsService) {}

  @Get()
  list(@Param('orgId') orgId: string, @Param('repoId') repoId: string) {
    return this.tags.list(orgId, repoId);
  }

  @Roles(OrgRole.DEVELOPER, OrgRole.DEVOPS, OrgRole.MANAGER)
  @Post()
  create(
    @Param('orgId') orgId: string,
    @Param('repoId') repoId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateTagDto,
  ) {
    return this.tags.create(orgId, repoId, userId, dto);
  }

  @Roles(OrgRole.DEVOPS, OrgRole.MANAGER)
  @Delete(':name')
  remove(
    @Param('orgId') orgId: string,
    @Param('repoId') repoId: string,
    @Param('name') name: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.tags.remove(orgId, repoId, decodeURIComponent(name), userId);
  }
}
