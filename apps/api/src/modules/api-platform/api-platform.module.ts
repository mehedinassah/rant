import { Module } from '@nestjs/common';
import { ApiPlatformController } from './api-platform.controller';
import { ApiKeysService } from './api-keys.service';
import { WebhooksService } from './webhooks.service';
import { WebhooksListeners } from './webhooks.listeners';

@Module({
  controllers: [ApiPlatformController],
  providers: [ApiKeysService, WebhooksService, WebhooksListeners],
  exports: [ApiKeysService, WebhooksService],
})
export class ApiPlatformModule {}
