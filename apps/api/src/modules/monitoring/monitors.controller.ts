import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Sse,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import { OrgRole } from '@rant/database';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { MonitorsService } from './monitors.service';
import { SimulateDto, UpdateMonitorDto } from './dto/monitoring.dto';

@Controller('organizations/:orgId/repositories/:repoId/monitors')
export class MonitorsController {
  constructor(private readonly monitors: MonitorsService) {}

  @Get()
  list(@Param('orgId') orgId: string, @Param('repoId') repoId: string) {
    return this.monitors.list(orgId, repoId);
  }

  @Get(':monitorId')
  get(
    @Param('orgId') orgId: string,
    @Param('repoId') repoId: string,
    @Param('monitorId') monitorId: string,
  ) {
    return this.monitors.get(orgId, repoId, monitorId);
  }

  @Get(':monitorId/metrics')
  metrics(
    @Param('orgId') orgId: string,
    @Param('repoId') repoId: string,
    @Param('monitorId') monitorId: string,
    @Query('minutes') minutes?: string,
  ) {
    return this.monitors.metrics(orgId, repoId, monitorId, minutes ? Number(minutes) : undefined);
  }

  /** Server-Sent Events: live monitor snapshots (status + samples + incidents). */
  @Sse(':monitorId/stream')
  stream(
    @Param('orgId') orgId: string,
    @Param('repoId') repoId: string,
    @Param('monitorId') monitorId: string,
  ): Observable<MessageEvent> {
    return this.monitors.stream(orgId, repoId, monitorId);
  }

  @Roles(OrgRole.DEVOPS, OrgRole.MANAGER)
  @Patch(':monitorId')
  update(
    @Param('orgId') orgId: string,
    @Param('repoId') repoId: string,
    @Param('monitorId') monitorId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: UpdateMonitorDto,
  ) {
    return this.monitors.update(orgId, repoId, monitorId, userId, dto);
  }

  /** Inject or clear a simulated outage (demoes the incident flow). */
  @Roles(OrgRole.DEVOPS, OrgRole.MANAGER)
  @Post(':monitorId/simulate')
  simulate(
    @Param('orgId') orgId: string,
    @Param('repoId') repoId: string,
    @Param('monitorId') monitorId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: SimulateDto,
  ) {
    return this.monitors.simulate(orgId, repoId, monitorId, userId, dto);
  }
}
