import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { IntegrationProvider } from '@rant/database';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../../common/audit/audit.service';
import { RepositoriesService } from '../../repositories/repositories.service';
import { CreateProjectLinkDto } from '../dto/integration.dto';

/**
 * Provider-agnostic CRUD for external-project links and the webhook ledger.
 * Vercel and Sentry share this so "connect a project" behaves (and is secured)
 * identically, while each provider's module owns its own payload mapping.
 */
@Injectable()
export class IntegrationLinksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly repos: RepositoriesService,
  ) {}

  async list(orgId: string, provider: IntegrationProvider) {
    return this.prisma.integrationProjectLink.findMany({
      where: { organizationId: orgId, provider },
      include: {
        repository: { select: { id: true, name: true, slug: true, defaultBranch: true } },
        environment: { select: { id: true, name: true, slug: true, type: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Upsert by (provider, externalProjectId) so re-linking is idempotent. */
  async create(
    orgId: string,
    actorId: string,
    provider: IntegrationProvider,
    dto: CreateProjectLinkDto,
  ) {
    await this.repos.assertRepo(orgId, dto.repositoryId);

    if (dto.environmentId) {
      const env = await this.prisma.environment.findFirst({
        where: { id: dto.environmentId, repositoryId: dto.repositoryId },
        select: { id: true },
      });
      if (!env) throw new BadRequestException('environmentId does not belong to this repository');
    }

    // A provider project is globally unique; never let one org re-point another
    // org's link (the webhook would otherwise start writing into the wrong org).
    const existing = await this.prisma.integrationProjectLink.findUnique({
      where: {
        provider_externalProjectId: { provider, externalProjectId: dto.externalProjectId },
      },
      select: { organizationId: true },
    });
    if (existing && existing.organizationId !== orgId) {
      throw new ConflictException('This provider project is already linked to another organization');
    }

    const link = await this.prisma.integrationProjectLink.upsert({
      where: {
        provider_externalProjectId: {
          provider,
          externalProjectId: dto.externalProjectId,
        },
      },
      create: {
        organizationId: orgId,
        provider,
        externalProjectId: dto.externalProjectId,
        externalProjectName: dto.externalProjectName ?? null,
        repositoryId: dto.repositoryId,
        environmentId: dto.environmentId ?? null,
      },
      update: {
        organizationId: orgId,
        externalProjectName: dto.externalProjectName ?? null,
        repositoryId: dto.repositoryId,
        environmentId: dto.environmentId ?? null,
      },
    });

    await this.audit.record({
      organizationId: orgId,
      actorId,
      action: `integration.${provider.toLowerCase()}.linked`,
      targetType: 'IntegrationProjectLink',
      targetId: link.id,
      metadata: {
        externalProjectId: dto.externalProjectId,
        repositoryId: dto.repositoryId,
        environmentId: dto.environmentId ?? null,
      },
    });
    return link;
  }

  async remove(orgId: string, actorId: string, provider: IntegrationProvider, linkId: string) {
    const link = await this.prisma.integrationProjectLink.findFirst({
      where: { id: linkId, organizationId: orgId, provider },
    });
    if (!link) throw new NotFoundException('Integration link not found');

    await this.prisma.integrationProjectLink.delete({ where: { id: link.id } });
    await this.audit.record({
      organizationId: orgId,
      actorId,
      action: `integration.${provider.toLowerCase()}.unlinked`,
      targetType: 'IntegrationProjectLink',
      targetId: link.id,
      metadata: { externalProjectId: link.externalProjectId },
    });
    return { success: true };
  }

  /** Recent inbound deliveries for the org's own linked projects only. */
  async deliveries(orgId: string, provider: IntegrationProvider, take = 50) {
    const projectIds = await this.linkedExternalProjectIds(orgId, provider);
    if (projectIds.length === 0) return [];
    return this.prisma.integrationWebhookDelivery.findMany({
      where: { provider, externalProjectId: { in: projectIds } },
      orderBy: { receivedAt: 'desc' },
      take,
    });
  }

  async deliveryCount(orgId: string, provider: IntegrationProvider): Promise<number> {
    const projectIds = await this.linkedExternalProjectIds(orgId, provider);
    if (projectIds.length === 0) return 0;
    return this.prisma.integrationWebhookDelivery.count({
      where: { provider, externalProjectId: { in: projectIds } },
    });
  }

  private async linkedExternalProjectIds(
    orgId: string,
    provider: IntegrationProvider,
  ): Promise<string[]> {
    const links = await this.prisma.integrationProjectLink.findMany({
      where: { organizationId: orgId, provider },
      select: { externalProjectId: true },
    });
    return links.map((link) => link.externalProjectId);
  }
}
