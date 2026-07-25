import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { OrgRole } from '@rant/database';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PipelinesService } from './pipelines.service';
import { RunsService } from './runs.service';
import { CreatePipelineDto, TriggerRunDto, UpdatePipelineDto } from './dto/ci.dto';

@Controller('organizations/:orgId/repositories/:repoId/pipelines')
export class PipelinesController {
  constructor(
    private readonly pipelines: PipelinesService,
    private readonly runs: RunsService,
  ) {}

  @Get()
  list(@Param('orgId') orgId: string, @Param('repoId') repoId: string) {
    return this.pipelines.list(orgId, repoId);
  }

  @Roles(OrgRole.DEVOPS, OrgRole.MANAGER)
  @Post()
  create(
    @Param('orgId') orgId: string,
    @Param('repoId') repoId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: CreatePipelineDto,
  ) {
    return this.pipelines.create(orgId, repoId, userId, dto);
  }

  @Get(':pipelineId')
  get(
    @Param('orgId') orgId: string,
    @Param('repoId') repoId: string,
    @Param('pipelineId') pipelineId: string,
  ) {
    return this.pipelines.findOne(orgId, repoId, pipelineId);
  }

  @Roles(OrgRole.DEVOPS, OrgRole.MANAGER)
  @Patch(':pipelineId')
  update(
    @Param('orgId') orgId: string,
    @Param('repoId') repoId: string,
    @Param('pipelineId') pipelineId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: UpdatePipelineDto,
  ) {
    return this.pipelines.update(orgId, repoId, pipelineId, userId, dto);
  }

  @Roles(OrgRole.DEVOPS, OrgRole.MANAGER)
  @Delete(':pipelineId')
  remove(
    @Param('orgId') orgId: string,
    @Param('repoId') repoId: string,
    @Param('pipelineId') pipelineId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.pipelines.remove(orgId, repoId, pipelineId, userId);
  }

  /** Manually dispatch this pipeline against a branch head. */
  @Roles(OrgRole.DEVELOPER, OrgRole.DEVOPS, OrgRole.MANAGER)
  @Post(':pipelineId/run')
  run(
    @Param('orgId') orgId: string,
    @Param('repoId') repoId: string,
    @Param('pipelineId') pipelineId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: TriggerRunDto,
  ) {
    return this.runs.triggerManual(orgId, repoId, pipelineId, userId, dto.branch);
  }
}
