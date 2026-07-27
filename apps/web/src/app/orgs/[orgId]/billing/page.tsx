'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  billing as billingApi,
  formatPrice,
  type Invoice,
  type PlanDefinition,
  type PlanTier,
  type Subscription,
  type UsageResponse,
} from '@/lib/api';
import { useRequireAuth } from '@/lib/use-require-auth';

const ORDER: PlanTier[] = ['FREE', 'PRO', 'ENTERPRISE'];

function UsageBar({ label, used, limit }: { label: string; used: number; limit: number | null }) {
  const pct = limit === null ? 0 : Math.min(100, Math.round((used / limit) * 100));
  const near = limit !== null && used >= limit;
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span className="text-white/60">{label}</span>
        <span className={near ? 'text-red-300' : 'text-white/70'}>
          {used}
          {limit === null ? ' / ∞' : ` / ${limit}`}
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full"
          style={{ width: `${limit === null ? 8 : pct}%`, background: near ? '#ef4444' : 'var(--color-accent)' }}
        />
      </div>
    </div>
  );
}

export default function BillingPage() {
  const ready = useRequireAuth();
  const { orgId } = useParams<{ orgId: string }>();
  const [plans, setPlans] = useState<PlanDefinition[]>([]);
  const [sub, setSub] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [p, s, u, inv] = await Promise.all([
        billingApi.plans(orgId),
        billingApi.subscription(orgId),
        billingApi.usage(orgId),
        billingApi.invoices(orgId),
      ]);
      setPlans(p);
      setSub(s);
      setUsage(u);
      setInvoices(inv);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    }
  }, [orgId]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  async function changePlan(plan: PlanTier) {
    setBusy(true);
    setError(null);
    try {
      await billingApi.changePlan(orgId, plan);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change plan');
    } finally {
      setBusy(false);
    }
  }

  async function toggleCancel() {
    setBusy(true);
    try {
      if (sub?.cancelAtPeriodEnd) await billingApi.resume(orgId);
      else await billingApi.cancel(orgId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return null;

  const currentIdx = sub ? ORDER.indexOf(sub.plan) : 0;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <Link href={`/orgs/${orgId}`} className="text-sm text-white/50 hover:text-white">
        ← Organization
      </Link>
      <h1 className="mt-3 text-2xl font-semibold">Billing</h1>
      <p className="text-sm text-white/40">Plans, usage, and invoices. (Payments are simulated.)</p>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      {sub && usage && (
        <>
          {/* Current plan + usage */}
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <section className="rounded-xl border border-white/10 bg-[var(--color-ink-soft)] p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-wide text-white/40">Current plan</div>
                  <div className="text-xl font-semibold">
                    {plans.find((p) => p.tier === sub.plan)?.label ?? sub.plan}
                  </div>
                </div>
                <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs">{sub.status}</span>
              </div>
              <p className="mt-2 text-sm text-white/50">
                Renews {new Date(sub.currentPeriodEnd).toLocaleDateString()}
                {sub.cancelAtPeriodEnd && ' · cancels at period end'}
              </p>
              {sub.plan !== 'FREE' && (
                <button
                  onClick={toggleCancel}
                  disabled={busy}
                  className="mt-3 rounded-lg border border-white/15 px-3 py-1.5 text-sm hover:bg-white/10 disabled:opacity-50"
                >
                  {sub.cancelAtPeriodEnd ? 'Resume subscription' : 'Cancel at period end'}
                </button>
              )}
            </section>

            <section className="rounded-xl border border-white/10 bg-[var(--color-ink-soft)] p-5">
              <div className="text-xs uppercase tracking-wide text-white/40">Usage this period</div>
              <div className="mt-3 space-y-3">
                <UsageBar label="Members" used={usage.usage.members.used} limit={usage.usage.members.limit} />
                <UsageBar label="Repositories" used={usage.usage.repositories.used} limit={usage.usage.repositories.limit} />
                <UsageBar label="Projects" used={usage.usage.projects.used} limit={usage.usage.projects.limit} />
              </div>
            </section>
          </div>

          {/* Plan cards */}
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {plans.map((plan) => {
              const idx = ORDER.indexOf(plan.tier);
              const isCurrent = sub.plan === plan.tier;
              const isUpgrade = idx > currentIdx;
              return (
                <div
                  key={plan.tier}
                  className={`rounded-xl border p-5 ${
                    isCurrent ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/5' : 'border-white/10 bg-[var(--color-ink-soft)]'
                  }`}
                >
                  <div className="flex items-baseline justify-between">
                    <h3 className="text-lg font-semibold">{plan.label}</h3>
                    <span className="text-sm text-white/60">{formatPrice(plan.priceCents)}</span>
                  </div>
                  <ul className="mt-3 space-y-1.5 text-sm text-white/60">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <span className="text-[var(--color-accent-soft)]">✓</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <button
                    disabled={isCurrent || busy}
                    onClick={() => changePlan(plan.tier)}
                    className={`mt-4 w-full rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50 ${
                      isCurrent
                        ? 'cursor-default border border-white/15 text-white/50'
                        : 'bg-[var(--color-accent)] text-white hover:opacity-90'
                    }`}
                  >
                    {isCurrent ? 'Current plan' : isUpgrade ? 'Upgrade' : 'Downgrade'}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Invoices */}
          <section className="mt-8">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-white/50">Invoices</h2>
            {invoices.length === 0 ? (
              <p className="mt-3 text-sm text-white/40">No invoices yet — upgrade to a paid plan to generate one.</p>
            ) : (
              <div className="mt-3 overflow-hidden rounded-xl border border-white/10">
                {invoices.map((inv, i) => (
                  <div
                    key={inv.id}
                    className={`flex items-center justify-between px-4 py-3 text-sm ${i > 0 ? 'border-t border-white/10' : ''}`}
                  >
                    <div>
                      <span className="font-medium">{formatPrice(inv.amountCents)}</span>
                      <span className="ml-2 text-white/40">{inv.plan}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-white/40">
                      <span>{new Date(inv.createdAt).toLocaleDateString()}</span>
                      <span className="rounded bg-green-500/15 px-1.5 py-0.5 text-green-300">{inv.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
