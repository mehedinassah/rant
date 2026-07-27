import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  MembershipStatus,
  NotificationType,
  OrgRole,
  Prisma,
} from '@rant/database';
import { interval, map, Observable, startWith, switchMap } from 'rxjs';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ALL_CATEGORIES, NOTIFICATION_META } from './notifications.constants';
import { PreferenceDto } from './dto/notification.dto';

export interface NotifyInput {
  recipientIds: string[];
  type: NotificationType;
  title: string;
  body?: string;
  organizationId?: string;
  repositoryId?: string;
  linkPath?: string;
  targetType?: string;
  targetId?: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger('Notifications');

  constructor(private readonly prisma: PrismaService) {}

  // ── Delivery (called by listeners) ─────────────────────────

  /** Active members of an org, optionally filtered by role, minus an actor. */
  async orgMemberIds(orgId: string, roles?: OrgRole[], excludeUserId?: string): Promise<string[]> {
    const members = await this.prisma.organizationMembership.findMany({
      where: {
        organizationId: orgId,
        status: MembershipStatus.ACTIVE,
        ...(roles && roles.length ? { role: { in: roles } } : {}),
      },
      select: { userId: true },
    });
    return members.map((m) => m.userId).filter((id) => id && id !== excludeUserId) as string[];
  }

  /**
   * Fan an event out to recipients' feeds, respecting each user's per-category
   * preference. In-app notifications are persisted; "email" is a logged stub
   * until a real provider (Resend) is wired up.
   */
  async notify(input: NotifyInput): Promise<number> {
    const recipients = [...new Set(input.recipientIds)].filter(Boolean);
    if (recipients.length === 0) return 0;

    const meta = NOTIFICATION_META[input.type];

    const prefs = await this.prisma.notificationPreference.findMany({
      where: { userId: { in: recipients }, category: meta.category },
    });
    const prefByUser = new Map(prefs.map((p) => [p.userId, p]));

    const rows: Prisma.NotificationCreateManyInput[] = [];
    for (const userId of recipients) {
      const pref = prefByUser.get(userId);
      const inApp = pref?.inApp ?? true; // default on
      const email = pref?.email ?? false; // default off
      if (email) {
        this.logger.log(`✉ (simulated) email → ${userId}: ${input.title}`);
      }
      if (!inApp) continue;
      rows.push({
        userId,
        type: input.type,
        category: meta.category,
        priority: meta.priority,
        title: input.title,
        body: input.body,
        organizationId: input.organizationId,
        repositoryId: input.repositoryId,
        linkPath: input.linkPath,
        targetType: input.targetType,
        targetId: input.targetId,
      });
    }

    if (rows.length === 0) return 0;
    await this.prisma.notification.createMany({ data: rows });
    this.logger.log(`🔔 ${input.type} → ${rows.length} recipient(s)`);
    return rows.length;
  }

  // ── Reading / managing (per-user API) ──────────────────────

  async list(userId: string, unreadOnly = false, take = 50) {
    return this.prisma.notification.findMany({
      where: { userId, ...(unreadOnly ? { readAt: null } : {}) },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  async unreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, readAt: null } });
  }

  async markRead(userId: string, id: string) {
    const n = await this.prisma.notification.findFirst({ where: { id, userId } });
    if (!n) throw new NotFoundException('Notification not found');
    if (!n.readAt) {
      await this.prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
    }
    return { success: true };
  }

  async markAllRead(userId: string) {
    const { count } = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { success: true, count };
  }

  async remove(userId: string, id: string) {
    const n = await this.prisma.notification.findFirst({ where: { id, userId } });
    if (!n) throw new NotFoundException('Notification not found');
    await this.prisma.notification.delete({ where: { id } });
    return { success: true };
  }

  // ── Preferences ────────────────────────────────────────────

  /** Returns a full preference set, filling gaps with defaults (inApp on). */
  async getPreferences(userId: string) {
    const existing = await this.prisma.notificationPreference.findMany({ where: { userId } });
    const byCat = new Map(existing.map((p) => [p.category, p]));
    return ALL_CATEGORIES.map((category) => {
      const p = byCat.get(category);
      return { category, inApp: p?.inApp ?? true, email: p?.email ?? false };
    });
  }

  async updatePreferences(userId: string, prefs: PreferenceDto[]) {
    for (const p of prefs) {
      await this.prisma.notificationPreference.upsert({
        where: { userId_category: { userId, category: p.category } },
        create: {
          userId,
          category: p.category,
          inApp: p.inApp ?? true,
          email: p.email ?? false,
        },
        update: {
          ...(p.inApp !== undefined ? { inApp: p.inApp } : {}),
          ...(p.email !== undefined ? { email: p.email } : {}),
        },
      });
    }
    return this.getPreferences(userId);
  }

  /** SSE: push unread count + latest notifications for the live bell. */
  stream(userId: string): Observable<MessageEvent> {
    return interval(3_000).pipe(
      startWith(0),
      switchMap(async () => {
        const [unread, latest] = await Promise.all([
          this.unreadCount(userId),
          this.list(userId, false, 10),
        ]);
        return { unread, latest };
      }),
      map((data) => ({ data }) as MessageEvent),
    );
  }
}
