import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingWebhookController } from './billing-webhook.controller';
import { BillingService } from './billing.service';

@Module({
  controllers: [BillingController, BillingWebhookController],
  providers: [BillingService],
  // Exported so create paths (projects, repos, members) can enforce plan limits.
  exports: [BillingService],
})
export class BillingModule {}
