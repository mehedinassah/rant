import { PlanTier } from '@rant/database';

export interface CheckoutInput {
  orgId: string;
  plan: PlanTier;
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutResult {
  /** Where to send the user (a real Stripe URL, or a local success URL). */
  url: string;
  /** Simulated providers apply the plan change immediately; Stripe waits for the
   * webhook, so this is false. */
  applyImmediately: boolean;
}

/** Normalized billing event distilled from a provider webhook. */
export type BillingEvent =
  | { type: 'subscription.active'; orgId: string; plan: PlanTier }
  | { type: 'subscription.canceled'; orgId: string }
  | null;

/** Pluggable payment backend. */
export interface BillingProvider {
  readonly name: string;
  createCheckout(input: CheckoutInput): Promise<CheckoutResult>;
  /** Verify + normalize a provider webhook (Stripe); simulated returns null. */
  parseWebhook(payload: Buffer, signature?: string): Promise<BillingEvent>;
}
