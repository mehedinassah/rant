import { createHmac, timingSafeEqual } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@rant/database';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { GithubConfig } from './github.config';

@Injectable()
export class GithubWebhookService {
  private readonly logger = new Logger('GithubWebhook');

  constructor(
    private readonly config: GithubConfig,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Verifies GitHub's `X-Hub-Signature-256` header against the raw request body
   * using HMAC-SHA256 and a timing-safe comparison. Returns false on any
   * malformed input rather than throwing.
   */
  verifySignature(rawBody: Buffer, signatureHeader: string | undefined): boolean {
    const secret = this.config.webhookSecret;
    if (!secret || !signatureHeader || !signatureHeader.startsWith('sha256=')) return false;

    const expected = 'sha256=' + createHmac('sha256', secret).update(rawBody).digest('hex');
    const a = Buffer.from(expected);
    const b = Buffer.from(signatureHeader);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }

  /**
   * Records a delivery id, returning true only the FIRST time it's seen. GitHub
   * redelivers on failure, so this makes downstream processing idempotent at the
   * boundary. Relies on the unique constraint on `deliveryId`.
   */
  async claimDelivery(deliveryId: string, event: string): Promise<boolean> {
    if (!deliveryId) return false;
    try {
      await this.prisma.githubWebhookDelivery.create({ data: { deliveryId, event } });
      return true;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        this.logger.debug(`Duplicate delivery ignored: ${deliveryId}`);
        return false;
      }
      throw err;
    }
  }
}
