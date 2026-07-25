import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { EpicsController } from './epics.controller';
import { EpicsService } from './epics.service';

@Module({
  imports: [ProjectsModule],
  controllers: [EpicsController],
  providers: [EpicsService],
})
export class EpicsModule {}
