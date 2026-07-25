import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { OrgRole } from '@rant/database';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { BranchesService } from './branches.service';
import { CreateBranchDto } from './dto/repository.dto';

@Controller('organizations/:orgId/repositories/:repoId/branches')
export class BranchesController {
  constructor(private readonly branches: BranchesService) {}

  @Get()
  list(@Param('orgId') orgId: string, @Param('repoId') repoId: string) {
    return this.branches.list(orgId, repoId);
  }

  @Roles(OrgRole.DEVELOPER, OrgRole.DEVOPS, OrgRole.MANAGER)
  @Post()
  create(
    @Param('orgId') orgId: string,
    @Param('repoId') repoId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateBranchDto,
  ) {
    return this.branches.create(orgId, repoId, userId, dto);
  }

  @Roles(OrgRole.DEVELOPER, OrgRole.DEVOPS, OrgRole.MANAGER)
  @Delete(':name')
  remove(
    @Param('orgId') orgId: string,
    @Param('repoId') repoId: string,
    @Param('name') name: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.branches.remove(orgId, repoId, decodeURIComponent(name), userId);
  }
}
