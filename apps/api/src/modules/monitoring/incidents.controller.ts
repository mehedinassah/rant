import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { OrgRole } from '@rant/database';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RepositoriesService } from '../repositories/repositories.service';
import { IncidentsService } from './incidents.service';
import { ResolveIncidentDto } from './dto/monitoring.dto';

@Controller('organizations/:orgId/repositories/:repoId/incidents')
export class IncidentsController {
  constructor(
    private readonly incidents: IncidentsService,
    private readonly repos: RepositoriesService,
  ) {}

  @Get()
  async list(@Param('orgId') orgId: string, @Param('repoId') repoId: string) {
    await this.repos.assertRepo(orgId, repoId);
    return this.incidents.listForRepo(repoId);
  }

  @Get(':incidentId')
  async get(
    @Param('orgId') orgId: string,
    @Param('repoId') repoId: string,
    @Param('incidentId') incidentId: string,
  ) {
    await this.repos.assertRepo(orgId, repoId);
    return this.incidents.get(repoId, incidentId);
  }

  @Roles(OrgRole.DEVOPS, OrgRole.MANAGER)
  @Post(':incidentId/acknowledge')
  acknowledge(
    @Param('orgId') orgId: string,
    @Param('repoId') repoId: string,
    @Param('incidentId') incidentId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.incidents.acknowledge(orgId, repoId, incidentId, userId);
  }

  @Roles(OrgRole.DEVOPS, OrgRole.MANAGER)
  @Post(':incidentId/resolve')
  resolve(
    @Param('orgId') orgId: string,
    @Param('repoId') repoId: string,
    @Param('incidentId') incidentId: string,
    @CurrentUser('userId') userId: string,
    @Body() _dto: ResolveIncidentDto,
  ) {
    return this.incidents.resolve(orgId, repoId, incidentId, userId);
  }
}
