import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditService } from '../../../common/audit/audit.service';
import { GithubConfig } from './github.config';
import { GithubAuthService } from './github-auth.service';
import { GITHUB_SYNC_QUEUE } from './github.constants';

/**
 * Org-facing connect flow: build install/OAuth URLs, record the installation and
 * kick backfill, report status, link user accounts, and disconnect. Kept in the
 * SPA/JWT model — GitHub redirects land on the web app, which calls these
 * authenticated endpoints (no server-side session/cookies needed).
 */
@Injectable()
export class GithubConnectService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: GithubConfig,
    private readonly auth: GithubAuthService,
    private readonly audit: AuditService,
    @InjectQueue(GITHUB_SYNC_QUEUE) private readonly syncQueue: Queue,
  ) {}

  private webUrl(): string {
    return process.env.WEB_URL?.replace(/\/$/, '') ?? 'http://localhost:3000';
  }

  installUrl(orgId: string): { url: string } {
    if (!this.config.appSlug) throw new BadRequestException('GitHub App slug not configured');
    const state = encodeURIComponent(orgId);
    return { url: `https://github.com/apps/${this.config.appSlug}/installations/new?state=${state}` };
  }

  oauthUrl(userId: string): { url: string } {
    if (!this.config.clientId) throw new BadRequestException('GitHub OAuth not configured');
    const redirect = encodeURIComponent(`${this.webUrl()}/settings/github/callback`);
    const state = encodeURIComponent(`oauth:${userId}`);
    return {
      url: `https://github.com/login/oauth/authorize?client_id=${this.config.clientId}&redirect_uri=${redirect}&state=${state}&scope=read:user`,
    };
  }

  /** Records a new installation and enqueues backfill. Idempotent per org. */
  async completeInstall(orgId: string, actorId: string, installationId: string) {
    // Prevent hijacking: an installation may only be bound to one org. If it's
    // already claimed elsewhere, refuse rather than silently rebinding.
    const claimed = await this.prisma.githubInstallation.findUnique({
      where: { installationId: BigInt(installationId) },
      select: { organizationId: true },
    });
    if (claimed && claimed.organizationId !== orgId) {
      throw new ForbiddenException('This GitHub installation is linked to another organization');
    }

    const meta = await this.auth.getInstallationMeta(installationId);
    const installation = await this.prisma.githubInstallation.upsert({
      where: { organizationId: orgId },
      create: {
        organizationId: orgId,
        installationId: BigInt(installationId),
        accountLogin: meta.accountLogin,
      },
      update: {
        installationId: BigInt(installationId),
        accountLogin: meta.accountLogin,
        suspendedAt: null,
      },
      select: { id: true, accountLogin: true },
    });

    await this.syncQueue.add('sync', { installationId }, { removeOnComplete: true, removeOnFail: 100 });
    await this.audit.record({
      organizationId: orgId,
      actorId,
      action: 'integration.github.connected',
      targetType: 'GithubInstallation',
      targetId: installation.id,
      metadata: { accountLogin: installation.accountLogin },
    });
    return { connected: true, accountLogin: installation.accountLogin };
  }

  async status(orgId: string) {
    const inst = await this.prisma.githubInstallation.findUnique({ where: { organizationId: orgId } });
    if (!inst) return { connected: false };
    const repoCount = await this.prisma.repository.count({
      where: { organizationId: orgId, source: 'GITHUB' },
    });
    return {
      connected: !inst.suspendedAt,
      accountLogin: inst.accountLogin,
      installationId: inst.installationId.toString(),
      syncedAt: inst.syncedAt,
      repoCount,
    };
  }

  async resync(orgId: string, actorId: string) {
    const inst = await this.prisma.githubInstallation.findUnique({ where: { organizationId: orgId } });
    if (!inst || inst.suspendedAt) throw new NotFoundException('GitHub is not connected');
    await this.syncQueue.add('sync', { installationId: inst.installationId.toString() }, { removeOnComplete: true });
    await this.audit.record({
      organizationId: orgId,
      actorId,
      action: 'integration.github.resynced',
      targetType: 'GithubInstallation',
      targetId: inst.id,
    });
    return { queued: true };
  }

  async disconnect(orgId: string, actorId: string) {
    const inst = await this.prisma.githubInstallation.findUnique({ where: { organizationId: orgId } });
    if (!inst) return { connected: false };
    this.auth.clearTokenCache(inst.installationId.toString());
    await this.prisma.githubInstallation.delete({ where: { organizationId: orgId } });
    await this.audit.record({
      organizationId: orgId,
      actorId,
      action: 'integration.github.disconnected',
      targetType: 'GithubInstallation',
      targetId: inst.id,
    });
    return { connected: false };
  }

  async linkAccount(userId: string, code: string) {
    const identity = await this.auth.exchangeOAuthCode(code);
    await this.prisma.githubAccountLink.upsert({
      where: { userId },
      create: {
        userId,
        githubId: BigInt(identity.githubId),
        login: identity.login,
        avatarUrl: identity.avatarUrl,
      },
      update: { githubId: BigInt(identity.githubId), login: identity.login, avatarUrl: identity.avatarUrl },
    });
    await this.audit.record({
      actorId: userId,
      action: 'integration.github.user_linked',
      targetType: 'User',
      targetId: userId,
      metadata: { login: identity.login },
    });
    return { login: identity.login, avatarUrl: identity.avatarUrl };
  }

  async account(userId: string) {
    const link = await this.prisma.githubAccountLink.findUnique({ where: { userId } });
    if (!link) return { linked: false };
    return { linked: true, login: link.login, avatarUrl: link.avatarUrl };
  }

  async unlinkAccount(userId: string) {
    await this.prisma.githubAccountLink.deleteMany({ where: { userId } });
    return { linked: false };
  }
}
