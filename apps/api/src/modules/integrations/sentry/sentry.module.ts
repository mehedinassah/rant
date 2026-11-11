import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { IntegrationsCommonModule } from '../common/integrations-common.module';
import { MonitoringModule } from '../../monitoring/monitoring.module';
import { SENTRY_EVENTS_QUEUE } from './sentry.constants';
import { SentryConfig } from './sentry.config';
import { SentryWebhookService } from './sentry-webhook.service';
import { SentryWebhookController } from './sentry-webhook.controller';
import { SentryIngestService } from './sentry-ingest.service';
import { SentryProcessor } from './sentry.processor';
import { SentryConnectService } from './sentry-connect.service';
import { SentryConnectController } from './sentry-connect.controller';

/**
 * Sentry integration: real issues open/resolve rant Incidents and re-emit the
 * same monitor events the scheduler does, so postmortems, notifications, chat
 * and webhooks ripple off production errors.
 */
@Module({
  imports: [
    IntegrationsCommonModule,
    MonitoringModule,
    BullModule.registerQueue({ name: SENTRY_EVENTS_QUEUE }),
  ],
  controllers: [SentryWebhookController, SentryConnectController],
  providers: [
    SentryConfig,
    SentryWebhookService,
    SentryIngestService,
    SentryProcessor,
    SentryConnectService,
  ],
  exports: [SentryConfig, SentryIngestService],
})
export class SentryModule {}
