import { Module } from '@nestjs/common';
import { RepositoriesModule } from '../repositories/repositories.module';
import { MonitorsController } from './monitors.controller';
import { MonitorsService } from './monitors.service';
import { IncidentsController } from './incidents.controller';
import { IncidentsService } from './incidents.service';
import { MonitoringScheduler } from './monitoring.scheduler';
import { MonitoringListeners } from './monitoring.listeners';

@Module({
  imports: [RepositoriesModule],
  controllers: [MonitorsController, IncidentsController],
  providers: [
    MonitorsService,
    IncidentsService,
    MonitoringScheduler,
    MonitoringListeners,
  ],
})
export class MonitoringModule {}
