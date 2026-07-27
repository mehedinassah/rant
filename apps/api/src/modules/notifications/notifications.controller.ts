import { Body, Controller, Delete, Get, Param, Post, Put, Query, Sse } from '@nestjs/common';
import type { Observable } from 'rxjs';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';
import { UpdatePreferencesDto } from './dto/notification.dto';

/**
 * User-scoped (no `:orgId`), so the RolesGuard is a no-op here — a user only
 * ever sees and manages their own notifications.
 */
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser('userId') userId: string, @Query('unread') unread?: string) {
    return this.notifications.list(userId, unread === 'true');
  }

  @Get('unread-count')
  async unreadCount(@CurrentUser('userId') userId: string) {
    return { count: await this.notifications.unreadCount(userId) };
  }

  @Get('preferences')
  getPreferences(@CurrentUser('userId') userId: string) {
    return this.notifications.getPreferences(userId);
  }

  @Put('preferences')
  updatePreferences(@CurrentUser('userId') userId: string, @Body() dto: UpdatePreferencesDto) {
    return this.notifications.updatePreferences(userId, dto.preferences);
  }

  /** Server-Sent Events: live unread count + latest notifications for the bell. */
  @Sse('stream')
  stream(@CurrentUser('userId') userId: string): Observable<MessageEvent> {
    return this.notifications.stream(userId);
  }

  @Post('read-all')
  markAllRead(@CurrentUser('userId') userId: string) {
    return this.notifications.markAllRead(userId);
  }

  @Post(':id/read')
  markRead(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    return this.notifications.markRead(userId, id);
  }

  @Delete(':id')
  remove(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    return this.notifications.remove(userId, id);
  }
}
