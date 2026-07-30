import { BillingEvent, BillingProvider, CheckoutInput, CheckoutResult } from '../billing.provider';

/**
 * Default billing backend: no real payment. "Checkout" resolves immediately and
 * the caller applies the plan change locally, so the whole billing UX works
 * without Stripe credentials.
 */
export class SimulatedBillingProvider implements BillingProvider {
  readonly name = 'simulated';

  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    return { url: input.successUrl, applyImmediately: true };
  }

  async parseWebhook(): Promise<BillingEvent> {
    return null; // no external webhooks in simulated mode
  }
}
