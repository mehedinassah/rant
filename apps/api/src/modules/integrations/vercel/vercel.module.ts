import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { IntegrationsCommonModule } from '../common/integrations-common.module';
import { VERCEL_EVENTS_QUEUE } from './vercel.constants';
import { VercelConfig } from './vercel.config';
import { VercelWebhookService } from './vercel-webhook.service';
import { VercelWebhookController } from './vercel-webhook.controller';
import { VercelIngestService } from './vercel-ingest.service';
import { VercelProcessor } from './vercel.processor';
import { VercelConnectService } from './vercel-connect.service';
import { VercelConnectController } from './vercel-connect.controller';

/**
 * Vercel integration: real deployments flow into rant's Deployment model and
 * re-emit `deployment.completed`, so monitoring/notifications/chat/webhooks
 * react exactly as they do for simulated deploys.
 */
@Module({
  imports: [
    IntegrationsCommonModule,
    BullModule.registerQueue({ name: VERCEL_EVENTS_QUEUE }),
  ],
  controllers: [VercelWebhookController, VercelConnectController],
  providers: [
    VercelConfig,
    VercelWebhookService,
    VercelIngestService,
    VercelProcessor,
    VercelConnectService,
  ],
  exports: [VercelConfig, VercelIngestService],
})
export class VercelModule {}
