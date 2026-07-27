import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { OrgRole } from '@rant/database';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { WEBHOOK_EVENTS } from './api-platform.constants';
import { ApiKeysService } from './api-keys.service';
import { WebhooksService } from './webhooks.service';
import { CreateApiKeyDto, CreateWebhookDto, UpdateWebhookDto } from './dto/api-platform.dto';

/** API keys and webhooks are org-admin concerns: OWNER/ADMIN only. */
@Controller('organizations/:orgId')
export class ApiPlatformController {
  constructor(
    private readonly apiKeys: ApiKeysService,
    private readonly webhooks: WebhooksService,
  ) {}

  // ── API keys ───────────────────────────────────────────────

  @Get('api-keys')
  listKeys(@Param('orgId') orgId: string) {
    return this.apiKeys.list(orgId);
  }

  @Roles(OrgRole.ADMIN)
  @Post('api-keys')
  createKey(
    @Param('orgId') orgId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateApiKeyDto,
  ) {
    return this.apiKeys.create(orgId, userId, dto);
  }

  @Roles(OrgRole.ADMIN)
  @Delete('api-keys/:keyId')
  revokeKey(
    @Param('orgId') orgId: string,
    @Param('keyId') keyId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.apiKeys.revoke(orgId, userId, keyId);
  }

  // ── Webhooks ───────────────────────────────────────────────

  /** The set of events a webhook can subscribe to. */
  @Get('webhook-events')
  events() {
    return WEBHOOK_EVENTS;
  }

  @Get('webhooks')
  listWebhooks(@Param('orgId') orgId: string) {
    return this.webhooks.list(orgId);
  }

  @Roles(OrgRole.ADMIN)
  @Post('webhooks')
  createWebhook(
    @Param('orgId') orgId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateWebhookDto,
  ) {
    return this.webhooks.create(orgId, userId, dto);
  }

  @Roles(OrgRole.ADMIN)
  @Patch('webhooks/:webhookId')
  updateWebhook(
    @Param('orgId') orgId: string,
    @Param('webhookId') webhookId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: UpdateWebhookDto,
  ) {
    return this.webhooks.update(orgId, userId, webhookId, dto);
  }

  @Roles(OrgRole.ADMIN)
  @Delete('webhooks/:webhookId')
  removeWebhook(
    @Param('orgId') orgId: string,
    @Param('webhookId') webhookId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.webhooks.remove(orgId, userId, webhookId);
  }

  @Get('webhooks/:webhookId/deliveries')
  deliveries(@Param('orgId') orgId: string, @Param('webhookId') webhookId: string) {
    return this.webhooks.listDeliveries(orgId, webhookId);
  }
}
