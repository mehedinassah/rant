import { Injectable } from '@nestjs/common';
import { IntegrationProvider } from '@rant/database';
import { IntegrationLinksService } from '../common/integration-links.service';
import { CreateProjectLinkDto } from '../dto/integration.dto';
import { SentryConfig } from './sentry.config';

@Injectable()
export class SentryConnectService {
  constructor(
    private readonly config: SentryConfig,
    private readonly links: IntegrationLinksService,
  ) {}

  async status(orgId: string) {
    const [links, deliveries] = await Promise.all([
      this.links.list(orgId, IntegrationProvider.SENTRY),
      this.links.deliveryCount(orgId, IntegrationProvider.SENTRY),
    ]);
    return {
      provider: 'sentry',
      enabled: this.config.isEnabled(),
      configured: this.config.isConfigured(),
      webhookPath: '/api/v1/integrations/sentry/webhook',
      linkedProjects: links.length,
      deliveries,
    };
  }

  listLinks(orgId: string) {
    return this.links.list(orgId, IntegrationProvider.SENTRY);
  }

  createLink(orgId: string, actorId: string, dto: CreateProjectLinkDto) {
    return this.links.create(orgId, actorId, IntegrationProvider.SENTRY, dto);
  }

  removeLink(orgId: string, actorId: string, linkId: string) {
    return this.links.remove(orgId, actorId, IntegrationProvider.SENTRY, linkId);
  }

  deliveries(orgId: string) {
    return this.links.deliveries(orgId, IntegrationProvider.SENTRY);
  }
}
