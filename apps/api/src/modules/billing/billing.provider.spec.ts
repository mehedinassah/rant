import { BillingService } from './billing.service';
import { SimulatedBillingProvider } from './providers/simulated.provider';

const cfg = (values: Record<string, string> = {}) =>
  ({ get: (k: string, d?: string) => values[k] ?? d ?? '' }) as never;

describe('BillingService provider selection', () => {
  it('defaults to the simulated provider', () => {
    expect(new BillingService({} as never, {} as never, cfg()).providerName).toBe('simulated');
  });

  it('selects Stripe when a secret key is present', () => {
    const svc = new BillingService({} as never, {} as never, cfg({ STRIPE_SECRET_KEY: 'sk_test_123' }));
    expect(svc.providerName).toBe('stripe');
  });

  it('honors explicit BILLING_PROVIDER=simulated even with a key', () => {
    const svc = new BillingService(
      {} as never,
      {} as never,
      cfg({ BILLING_PROVIDER: 'simulated', STRIPE_SECRET_KEY: 'sk_test_123' }),
    );
    expect(svc.providerName).toBe('simulated');
  });
});

describe('SimulatedBillingProvider', () => {
  const p = new SimulatedBillingProvider();

  it('resolves checkout immediately to the success URL', async () => {
    const res = await p.createCheckout({
      orgId: 'o1',
      plan: 'PRO' as never,
      successUrl: 'http://web/success',
      cancelUrl: 'http://web/cancel',
    });
    expect(res).toEqual({ url: 'http://web/success', applyImmediately: true });
  });

  it('has no webhook events', async () => {
    expect(await p.parseWebhook(Buffer.from(''), undefined)).toBeNull();
  });
});
