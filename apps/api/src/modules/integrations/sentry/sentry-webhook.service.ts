import { createHmac, timingSafeEqual } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { IntegrationProvider, Prisma } from '@rant/database';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { SentryConfig } from './sentry.config';

/**
 * Verifies Sentry's `sentry-hook-signature` (HMAC-SHA256 of the raw body, keyed
 * by the integration's Client Secret) and dedupes deliveries.
 */
@Injectable()
export class SentryWebhookService {
  private readonly logger = new Logger('SentryWebhook');

  constructor(
    private readonly config: SentryConfig,
    private readonly prisma: PrismaService,
  ) {}

  verifySignature(rawBody: Buffer, signatureHeader: string | undefined): boolean {
    const secret = this.config.webhookSecret;
    if (!secret || !signatureHeader) return false;

    const providedHex = signatureHeader.trim().toLowerCase().replace(/^sha256=/, '');
    const provided = Buffer.from(providedHex, 'utf8');
    const expected = Buffer.from(
      createHmac('sha256', secret).update(rawBody).digest('hex'),
      'utf8',
    );
    if (expected.length !== provided.length) return false;
    return timingSafeEqual(expected, provided);
  }

  /** True only the first time a delivery id is seen (unique ledger row). */
  async claimDelivery(
    deliveryId: string,
    event: string,
    externalProjectId?: string | null,
  ): Promise<boolean> {
    if (!deliveryId) return false;
    try {
      await this.prisma.integrationWebhookDelivery.create({
        data: {
          provider: IntegrationProvider.SENTRY,
          deliveryId,
          event,
          externalProjectId: externalProjectId ?? null,
        },
      });
      return true;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        this.logger.debug(`Duplicate Sentry delivery ignored: ${deliveryId}`);
        return false;
      }
      throw err;
    }
  }
}
