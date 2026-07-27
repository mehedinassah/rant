import { createHmac, randomBytes } from 'node:crypto';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { WebhookDeliveryStatus } from '@rant/database';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import {
  EVENT_HEADER,
  SIGNATURE_HEADER,
  WEBHOOK_TIMEOUT_MS,
} from './api-platform.constants';
import { CreateWebhookDto, UpdateWebhookDto } from './dto/api-platform.dto';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger('Webhooks');

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list(orgId: string) {
    return this.prisma.webhookEndpoint.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(orgId: string, actorId: string, dto: CreateWebhookDto) {
    const endpoint = await this.prisma.webhookEndpoint.create({
      data: {
        organizationId: orgId,
        url: dto.url,
        secret: `whsec_${randomBytes(20).toString('base64url')}`,
        events: dto.events ?? ['*'],
      },
    });
    await this.audit.record({
      organizationId: orgId,
      actorId,
      action: 'webhook.created',
      targetType: 'WebhookEndpoint',
      targetId: endpoint.id,
      metadata: { url: dto.url, events: endpoint.events },
    });
    return endpoint;
  }

  async update(orgId: string, actorId: string, id: string, dto: UpdateWebhookDto) {
    await this.assert(orgId, id);
    const endpoint = await this.prisma.webhookEndpoint.update({
      where: { id },
      data: { url: dto.url, events: dto.events, isActive: dto.isActive },
    });
    await this.audit.record({
      organizationId: orgId,
      actorId,
      action: 'webhook.updated',
      targetType: 'WebhookEndpoint',
      targetId: id,
    });
    return endpoint;
  }

  async remove(orgId: string, actorId: string, id: string) {
    await this.assert(orgId, id);
    await this.prisma.webhookEndpoint.delete({ where: { id } });
    await this.audit.record({
      organizationId: orgId,
      actorId,
      action: 'webhook.deleted',
      targetType: 'WebhookEndpoint',
      targetId: id,
    });
    return { success: true };
  }

  async listDeliveries(orgId: string, id: string) {
    await this.assert(orgId, id);
    return this.prisma.webhookDelivery.findMany({
      where: { endpointId: id },
      orderBy: { createdAt: 'desc' },
      take: 25,
    });
  }

  private async assert(orgId: string, id: string) {
    const endpoint = await this.prisma.webhookEndpoint.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!endpoint) throw new NotFoundException('Webhook endpoint not found');
    return endpoint;
  }

  /**
   * Fan an event out to every subscribed, active endpoint in the org. Each
   * delivery is HMAC-signed and its outcome recorded — best-effort, never
   * throwing back into the event bus.
   */
  async dispatch(orgId: string, event: string, payload: Record<string, unknown>): Promise<void> {
    const endpoints = await this.prisma.webhookEndpoint.findMany({
      where: { organizationId: orgId, isActive: true },
    });
    const targets = endpoints.filter((e) => e.events.includes('*') || e.events.includes(event));
    if (targets.length === 0) return;

    const body = JSON.stringify({ event, data: payload, timestamp: new Date().toISOString() });

    await Promise.all(
      targets.map(async (endpoint) => {
        const signature = createHmac('sha256', endpoint.secret).update(body).digest('hex');
        let status: WebhookDeliveryStatus = WebhookDeliveryStatus.FAILED;
        let statusCode: number | null = null;
        let error: string | null = null;

        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);
          const res = await fetch(endpoint.url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              [EVENT_HEADER]: event,
              [SIGNATURE_HEADER]: `sha256=${signature}`,
            },
            body,
            signal: controller.signal,
          });
          clearTimeout(timer);
          statusCode = res.status;
          status = res.ok ? WebhookDeliveryStatus.SUCCESS : WebhookDeliveryStatus.FAILED;
        } catch (err) {
          error = err instanceof Error ? err.message : String(err);
        }

        await this.prisma.webhookDelivery.create({
          data: { endpointId: endpoint.id, event, payload: payload as object, status, statusCode, error },
        });
        this.logger.log(`→ ${event} to ${endpoint.url}: ${status}${statusCode ? ` (${statusCode})` : ''}`);
      }),
    );
  }
}
