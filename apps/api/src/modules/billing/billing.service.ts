import { ForbiddenException, Injectable } from '@nestjs/common';
import { InvoiceStatus, PlanTier, Subscription, SubscriptionStatus } from '@rant/database';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { GatedResource, PLAN_ORDER, PLANS } from './billing.constants';

const PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

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

  async changePlan(orgId: string, actorId: string, plan: PlanTier) {
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
