import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationsListeners } from './notifications.listeners';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsListeners],
})
export class NotificationsModule {}
