import Stripe from 'stripe';
import { PlanTier } from '@rant/database';
import { BillingEvent, BillingProvider, CheckoutInput, CheckoutResult } from '../billing.provider';

export interface StripeOptions {
  secretKey: string;
  webhookSecret: string;
  /** PlanTier → Stripe Price id. */
  prices: Partial<Record<PlanTier, string>>;
}

/** Real payments via Stripe Checkout + subscription webhooks. Activated by
 * STRIPE_SECRET_KEY. Works in Stripe test mode with test keys. */
export class StripeBillingProvider implements BillingProvider {
  readonly name = 'stripe';
  private readonly stripe: Stripe;

  constructor(private readonly opts: StripeOptions) {
    this.stripe = new Stripe(opts.secretKey);
  }

  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    const price = this.opts.prices[input.plan];
    if (!price) throw new Error(`No Stripe price configured for plan ${input.plan}`);

    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price, quantity: 1 }],
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      client_reference_id: input.orgId,
      metadata: { orgId: input.orgId, plan: input.plan },
      subscription_data: { metadata: { orgId: input.orgId, plan: input.plan } },
    });
    return { url: session.url ?? input.successUrl, applyImmediately: false };
  }

  async parseWebhook(payload: Buffer, signature?: string): Promise<BillingEvent> {
    if (!signature) return null;
    const event = this.stripe.webhooks.constructEvent(payload, signature, this.opts.webhookSecret);

    if (event.type === 'checkout.session.completed') {
      const s = event.data.object as Stripe.Checkout.Session;
      const orgId = s.metadata?.orgId;
      const plan = s.metadata?.plan as PlanTier | undefined;
      if (orgId && plan) return { type: 'subscription.active', orgId, plan };
    }
    if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object as Stripe.Subscription;
      const orgId = sub.metadata?.orgId;
      if (orgId) return { type: 'subscription.canceled', orgId };
    }
    return null;
  }
}
