import { Injectable } from '@nestjs/common';
import { IntegrationProvider } from '@rant/database';
import { IntegrationLinksService } from '../common/integration-links.service';
import { CreateProjectLinkDto } from '../dto/integration.dto';
import { VercelConfig } from './vercel.config';

@Injectable()
export class VercelConnectService {
  constructor(
    private readonly config: VercelConfig,
    private readonly links: IntegrationLinksService,
  ) {}

  async status(orgId: string) {
    const [links, deliveries] = await Promise.all([
      this.links.list(orgId, IntegrationProvider.VERCEL),
      this.links.deliveryCount(orgId, IntegrationProvider.VERCEL),
    ]);
    return {
      provider: 'vercel',
      enabled: this.config.isEnabled(),
      configured: this.config.isConfigured(),
      teamId: this.config.teamId || null,
      webhookPath: '/api/v1/integrations/vercel/webhook',
      linkedProjects: links.length,
      deliveries,
    };
  }

  listLinks(orgId: string) {
    return this.links.list(orgId, IntegrationProvider.VERCEL);
  }

  createLink(orgId: string, actorId: string, dto: CreateProjectLinkDto) {
    return this.links.create(orgId, actorId, IntegrationProvider.VERCEL, dto);
  }

  removeLink(orgId: string, actorId: string, linkId: string) {
    return this.links.remove(orgId, actorId, IntegrationProvider.VERCEL, linkId);
  }

  deliveries(orgId: string) {
    return this.links.deliveries(orgId, IntegrationProvider.VERCEL);
  }
}
