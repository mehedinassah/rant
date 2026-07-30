import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InvoiceStatus, PlanTier, Subscription, SubscriptionStatus } from '@rant/database';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { GatedResource, PLAN_ORDER, PLANS } from './billing.constants';
import { BillingProvider } from './billing.provider';
import { SimulatedBillingProvider } from './providers/simulated.provider';
import { StripeBillingProvider } from './providers/stripe.provider';

const PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class BillingService {
  private readonly logger = new Logger('Billing');
  private readonly provider: BillingProvider;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {
    this.provider = BillingService.selectProvider(config);
    this.logger.log(`billing provider: ${this.provider.name}`);
  }

  private static selectProvider(config: ConfigService): BillingProvider {
    const secret = config.get<string>('STRIPE_SECRET_KEY', '');
    const explicit = config.get<string>('BILLING_PROVIDER', '');
    const useStripe = explicit === 'stripe' || (explicit === '' && Boolean(secret));
    if (useStripe && secret) {
      return new StripeBillingProvider({
        secretKey: secret,
        webhookSecret: config.get<string>('STRIPE_WEBHOOK_SECRET', ''),
        prices: {
          [PlanTier.PRO]: config.get<string>('STRIPE_PRICE_PRO', ''),
          [PlanTier.ENTERPRISE]: config.get<string>('STRIPE_PRICE_ENTERPRISE', ''),
        },
      });
    }
    return new SimulatedBillingProvider();
  }

  get providerName(): string {
    return this.provider.name;
  }

  /** Every org has a subscription; one is lazily created (FREE) on first access. */
  async getSubscription(orgId: string): Promise<Subscription> {
    return this.prisma.subscription.upsert({
      where: { organizationId: orgId },
      create: {
        organizationId: orgId,
        plan: PlanTier.FREE,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: new Date(Date.now() + PERIOD_MS),
      },
      update: {},
    });
  }

  private async currentCount(orgId: string, resource: GatedResource): Promise<number> {
    switch (resource) {
      case 'members':
        return this.prisma.organizationMembership.count({
          where: { organizationId: orgId, status: 'ACTIVE' },
        });
      case 'repositories':
        return this.prisma.repository.count({ where: { organizationId: orgId } });
      case 'projects':
        return this.prisma.project.count({ where: { workspace: { organizationId: orgId } } });
    }
  }

  /** Throws 403 if creating another `resource` would exceed the org's plan. */
  async assertWithinLimit(orgId: string, resource: GatedResource): Promise<void> {
    const sub = await this.getSubscription(orgId);
    const limit = PLANS[sub.plan].limits[resource];
    if (limit === null) return; // unlimited
    const count = await this.currentCount(orgId, resource);
    if (count >= limit) {
      throw new ForbiddenException(
        `Your ${PLANS[sub.plan].label} plan allows ${limit} ${resource}. Upgrade to add more.`,
      );
    }
  }

  async getUsage(orgId: string) {
    const sub = await this.getSubscription(orgId);
    const limits = PLANS[sub.plan].limits;
    const [members, repositories, projects] = await Promise.all([
      this.currentCount(orgId, 'members'),
      this.currentCount(orgId, 'repositories'),
      this.currentCount(orgId, 'projects'),
    ]);
    return {
      plan: sub.plan,
      usage: {
        members: { used: members, limit: limits.members },
        repositories: { used: repositories, limit: limits.repositories },
        projects: { used: projects, limit: limits.projects },
      },
    };
  }

  private returnUrl(orgId: string, status: 'success' | 'cancel'): string {
    const web = this.config.get<string>('WEB_URL', 'http://localhost:3000').replace(/\/$/, '');
    return `${web}/orgs/${orgId}/billing?checkout=${status}`;
  }

  /**
   * Starts an upgrade. In simulated mode the plan changes immediately and we
   * return a local success URL; with Stripe we return a Checkout URL and defer
   * the change to the webhook. Downgrades to FREE are always immediate.
   */
  async startCheckout(orgId: string, actorId: string, plan: PlanTier) {
    if (plan === PlanTier.FREE) {
      await this.changePlan(orgId, actorId, plan);
      return { url: this.returnUrl(orgId, 'success'), applied: true };
    }
    const result = await this.provider.createCheckout({
      orgId,
      plan,
      successUrl: this.returnUrl(orgId, 'success'),
      cancelUrl: this.returnUrl(orgId, 'cancel'),
    });
    if (result.applyImmediately) {
      await this.changePlan(orgId, actorId, plan);
      return { url: result.url, applied: true };
    }
    return { url: result.url, applied: false };
  }

  /** Applies a verified provider webhook (Stripe) to the local subscription. */
  async handleWebhook(payload: Buffer, signature?: string) {
    let event;
    try {
      event = await this.provider.parseWebhook(payload, signature);
    } catch (err) {
      throw new BadRequestException(`Webhook verification failed: ${(err as Error).message}`);
    }
    if (!event) return { received: true };

    if (event.type === 'subscription.active') {
      await this.changePlan(event.orgId, null, event.plan);
    } else if (event.type === 'subscription.canceled') {
      await this.prisma.subscription.updateMany({
        where: { organizationId: event.orgId },
        data: { status: SubscriptionStatus.CANCELLED, cancelAtPeriodEnd: true },
      });
    }
    return { received: true };
  }

  async changePlan(orgId: string, actorId: string | null, plan: PlanTier) {
    const current = await this.getSubscription(orgId);
    const now = new Date();
    const periodEnd = new Date(now.getTime() + PERIOD_MS);

    const sub = await this.prisma.subscription.update({
      where: { organizationId: orgId },
      data: {
        plan,
        status: SubscriptionStatus.ACTIVE,
        cancelAtPeriodEnd: false,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      },
    });

    // Mint a (simulated) invoice for paid plans.
    const amount = PLANS[plan].priceCents;
    if (amount > 0) {
      await this.prisma.invoice.create({
        data: {
          organizationId: orgId,
          plan,
          amountCents: amount,
          status: InvoiceStatus.PAID,
          periodStart: now,
          periodEnd,
          paidAt: now,
        },
      });
    }

    await this.audit.record({
      organizationId: orgId,
      actorId,
      action: 'subscription.changed',
      targetType: 'Subscription',
      targetId: sub.id,
      metadata: { from: current.plan, to: plan },
    });
    return sub;
  }

  async cancel(orgId: string, actorId: string) {
    await this.getSubscription(orgId);
    const sub = await this.prisma.subscription.update({
      where: { organizationId: orgId },
      data: { cancelAtPeriodEnd: true },
    });
    await this.audit.record({
      organizationId: orgId,
      actorId,
      action: 'subscription.cancel_scheduled',
      targetType: 'Subscription',
      targetId: sub.id,
    });
    return sub;
  }

  async resume(orgId: string, actorId: string) {
    await this.getSubscription(orgId);
    const sub = await this.prisma.subscription.update({
      where: { organizationId: orgId },
      data: { cancelAtPeriodEnd: false },
    });
    await this.audit.record({
      organizationId: orgId,
      actorId,
      action: 'subscription.resumed',
      targetType: 'Subscription',
      targetId: sub.id,
    });
    return sub;
  }

  listInvoices(orgId: string) {
    return this.prisma.invoice.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  plans() {
    return PLAN_ORDER.map((tier) => PLANS[tier]);
  }
}
