import { createHmac, timingSafeEqual } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { IntegrationProvider, Prisma } from '@rant/database';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { VercelConfig } from './vercel.config';

/**
 * Verifies Vercel webhook signatures and dedupes deliveries. Vercel signs the
 * raw body with the webhook secret using HMAC-SHA1; newer endpoints also offer
 * HMAC-SHA256, so both are accepted. Comparison is timing-safe.
 */
@Injectable()
export class VercelWebhookService {
  private readonly logger = new Logger('VercelWebhook');

  constructor(
    private readonly config: VercelConfig,
    private readonly prisma: PrismaService,
  ) {}

  verifySignature(rawBody: Buffer, signatureHeader: string | undefined): boolean {
    const secret = this.config.webhookSecret;
    if (!secret || !signatureHeader) return false;

    const provided = Buffer.from(signatureHeader.trim().toLowerCase(), 'utf8');
    for (const algorithm of ['sha1', 'sha256'] as const) {
      const expectedHex = createHmac(algorithm, secret).update(rawBody).digest('hex');
      const expected = Buffer.from(expectedHex, 'utf8');
      if (expected.length === provided.length && timingSafeEqual(expected, provided)) {
        return true;
      }
    }
    return false;
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
          provider: IntegrationProvider.VERCEL,
          deliveryId,
          event,
          externalProjectId: externalProjectId ?? null,
        },
      });
      return true;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        this.logger.debug(`Duplicate Vercel delivery ignored: ${deliveryId}`);
        return false;
      }
      throw err;
    }
  }
}
