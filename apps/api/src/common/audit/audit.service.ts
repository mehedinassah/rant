import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@rant/database';
import { PrismaService } from '../prisma/prisma.service';
import { normalizePage, Paginated } from '../pagination';

export interface AuditEntry {
  organizationId?: string | null;
  actorId?: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Prisma.InputJsonValue;
  ip?: string;
}

export interface AuditQuery {
  page?: number;
  pageSize?: number;
  action?: string;
  actorId?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger('Audit');

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Records an immutable audit event. Failures are swallowed (logged only) so
   * auditing never blocks the primary operation.
   */
  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          organizationId: entry.organizationId ?? null,
          actorId: entry.actorId ?? null,
          action: entry.action,
          targetType: entry.targetType,
          targetId: entry.targetId,
          metadata: entry.metadata,
          ip: entry.ip,
        },
      });
    } catch (err) {
      this.logger.error(`Failed to write audit log for "${entry.action}"`, err as Error);
    }
  }

  /** Paginated, filterable read of an org's immutable activity log. */
  async list(orgId: string, query: AuditQuery): Promise<Paginated<unknown>> {
    const { skip, take, page, pageSize } = normalizePage(query.page, query.pageSize);
    const where: Prisma.AuditLogWhereInput = {
      organizationId: orgId,
      ...(query.action ? { action: { contains: query.action, mode: 'insensitive' } } : {}),
      ...(query.actorId ? { actorId: query.actorId } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: { actor: { select: { id: true, name: true, avatarUrl: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { items, total, page, pageSize, hasMore: skip + items.length < total };
  }
}
