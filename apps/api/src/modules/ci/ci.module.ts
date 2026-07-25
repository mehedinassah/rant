import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { RepositoriesModule } from '../repositories/repositories.module';
import { PIPELINE_QUEUE } from './ci.constants';
import { PipelinesController } from './pipelines.controller';
import { PipelinesService } from './pipelines.service';
import { RunsController } from './runs.controller';
import { RunsService } from './runs.service';
import { PipelineProcessor } from './pipeline.processor';
import { CiListeners } from './ci.listeners';

@Module({
  imports: [BullModule.registerQueue({ name: PIPELINE_QUEUE }), RepositoriesModule],
  controllers: [PipelinesController, RunsController],
  providers: [PipelinesService, RunsService, PipelineProcessor, CiListeners],
  exports: [RunsService],
})
export class CiModule {}
