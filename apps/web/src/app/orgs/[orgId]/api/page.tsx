'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  apiPlatform,
  API_ORIGIN,
  type ApiKey,
  type ApiKeyCreated,
  type Webhook,
  type WebhookDelivery,
} from '@/lib/api';
import { useRequireAuth } from '@/lib/use-require-auth';

function timeAgo(iso?: string | null): string {
  if (!iso) return 'never';
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function ApiPlatformPage() {
  const ready = useRequireAuth();
  const { orgId } = useParams<{ orgId: string }>();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [events, setEvents] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // create-key form
  const [keyName, setKeyName] = useState('');
  const [freshKey, setFreshKey] = useState<ApiKeyCreated | null>(null);

  // create-webhook form
  const [hookUrl, setHookUrl] = useState('');
  const [hookEvents, setHookEvents] = useState<string[]>([]);

  // deliveries panel
  const [openDeliveries, setOpenDeliveries] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);

  const load = useCallback(async () => {
    try {
      const [k, w, e] = await Promise.all([
        apiPlatform.listKeys(orgId),
        apiPlatform.listWebhooks(orgId),
        apiPlatform.webhookEvents(orgId),
      ]);
      setKeys(k);
      setWebhooks(w);
      setEvents(e);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    }
  }, [orgId]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  async function createKey(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const created = await apiPlatform.createKey(orgId, { name: keyName });
      setFreshKey(created);
      setKeyName('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create key');
    }
  }

  async function revokeKey(id: string) {
    if (!confirm('Revoke this key? Clients using it will stop working immediately.')) return;
    await apiPlatform.revokeKey(orgId, id).catch(() => undefined);
    await load();
  }

  async function createWebhook(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiPlatform.createWebhook(orgId, {
        url: hookUrl,
        events: hookEvents.length ? hookEvents : ['*'],
      });
      setHookUrl('');
      setHookEvents([]);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create webhook');
    }
  }

  async function toggleWebhook(w: Webhook) {
    await apiPlatform.updateWebhook(orgId, w.id, { isActive: !w.isActive }).catch(() => undefined);
    await load();
  }

  async function removeWebhook(id: string) {
    if (!confirm('Delete this webhook endpoint?')) return;
    await apiPlatform.removeWebhook(orgId, id).catch(() => undefined);
    await load();
  }

  async function showDeliveries(id: string) {
    if (openDeliveries === id) {
      setOpenDeliveries(null);
      return;
    }
    setOpenDeliveries(id);
    setDeliveries(await apiPlatform.deliveries(orgId, id).catch(() => []));
  }

  if (!ready) return null;

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Link href={`/orgs/${orgId}`} className="text-sm text-white/50 hover:text-white">
        ← Organization
      </Link>
      <div className="mt-3 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">API &amp; Webhooks</h1>
          <p className="text-sm text-white/40">Programmatic access and event delivery.</p>
        </div>
        <a
          href={`${API_ORIGIN}/docs`}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg border border-white/15 px-3 py-1.5 text-sm hover:bg-white/10"
        >
          📖 OpenAPI docs ↗
        </a>
      </div>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      {/* API keys */}
      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-white/50">API keys</h2>

        {freshKey && (
          <div className="mt-3 rounded-xl border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10 p-4">
            <p className="text-sm font-medium text-[var(--color-accent-soft)]">
              Copy your new key now — it won&apos;t be shown again.
            </p>
            <div className="mt-2 flex items-center gap-2">
              <code className="flex-1 overflow-x-auto rounded-lg bg-black/50 px-3 py-2 font-mono text-sm">
                {freshKey.key}
              </code>
              <button
                onClick={() => navigator.clipboard?.writeText(freshKey.key)}
                className="rounded-lg bg-white/10 px-3 py-2 text-sm hover:bg-white/20"
              >
                Copy
              </button>
              <button
                onClick={() => setFreshKey(null)}
                className="rounded-lg border border-white/15 px-3 py-2 text-sm hover:bg-white/10"
              >
                Done
              </button>
            </div>
          </div>
        )}

        <form onSubmit={createKey} className="mt-3 flex gap-2">
          <input
            value={keyName}
            onChange={(e) => setKeyName(e.target.value)}
            placeholder="Key name (e.g. CI deploy bot)"
            required
            className="flex-1 rounded-lg border border-white/10 bg-[var(--color-ink-soft)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
          />
          <button className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90">
            + Create key
          </button>
        </form>

        {keys.length === 0 ? (
          <p className="mt-3 text-sm text-white/40">No API keys yet.</p>
        ) : (
          <div className="mt-3 overflow-hidden rounded-xl border border-white/10">
            {keys.map((k, i) => (
              <div
                key={k.id}
                className={`flex items-center justify-between px-4 py-3 ${i > 0 ? 'border-t border-white/10' : ''}`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{k.name}</span>
                    <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs text-white/60">
                      {k.prefix}…
                    </code>
                    {k.revokedAt && (
                      <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-xs text-red-300">revoked</span>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-white/40">
                    last used {timeAgo(k.lastUsedAt)} · created {timeAgo(k.createdAt)}
                    {k.expiresAt && ` · expires ${timeAgo(k.expiresAt)}`}
                  </div>
                </div>
                {!k.revokedAt && (
                  <button
                    onClick={() => revokeKey(k.id)}
                    className="rounded-lg border border-white/15 px-3 py-1.5 text-sm text-red-300 hover:bg-red-500/10"
                  >
                    Revoke
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Webhooks */}
      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-white/50">Webhooks</h2>

        <form onSubmit={createWebhook} className="mt-3 space-y-3 rounded-xl border border-white/10 bg-[var(--color-ink-soft)] p-4">
          <input
            value={hookUrl}
            onChange={(e) => setHookUrl(e.target.value)}
            placeholder="https://example.com/webhooks/rant"
            required
            className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
          />
          <div className="flex flex-wrap gap-2 text-xs">
            {events.map((ev) => {
              const on = hookEvents.includes(ev);
              return (
                <button
                  type="button"
                  key={ev}
                  onClick={() =>
                    setHookEvents((prev) => (on ? prev.filter((x) => x !== ev) : [...prev, ev]))
                  }
                  className={`rounded-full border px-2.5 py-1 font-mono ${
                    on
                      ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/20 text-white'
                      : 'border-white/15 text-white/50 hover:bg-white/5'
                  }`}
                >
                  {ev}
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/40">
              {hookEvents.length === 0 ? 'No events selected → subscribes to all (*)' : `${hookEvents.length} event(s)`}
            </span>
            <button className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90">
              + Add webhook
            </button>
          </div>
        </form>

        {webhooks.length === 0 ? (
          <p className="mt-3 text-sm text-white/40">No webhook endpoints yet.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {webhooks.map((w) => (
              <div key={w.id} className="rounded-xl border border-white/10 bg-[var(--color-ink-soft)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${w.isActive ? 'bg-green-400' : 'bg-white/30'}`}
                      />
                      <code className="truncate font-mono text-sm">{w.url}</code>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {w.events.map((e) => (
                        <span key={e} className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[11px] text-white/60">
                          {e}
                        </span>
                      ))}
                    </div>
                    <div className="mt-1 text-[11px] text-white/30">
                      secret <code className="font-mono">{w.secret}</code>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      onClick={() => showDeliveries(w.id)}
                      className="rounded-lg border border-white/15 px-3 py-1.5 text-sm hover:bg-white/10"
                    >
                      Deliveries
                    </button>
                    <button
                      onClick={() => toggleWebhook(w)}
                      className="rounded-lg border border-white/15 px-3 py-1.5 text-sm hover:bg-white/10"
                    >
                      {w.isActive ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      onClick={() => removeWebhook(w.id)}
                      className="rounded-lg border border-white/15 px-3 py-1.5 text-sm text-red-300 hover:bg-red-500/10"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {openDeliveries === w.id && (
                  <div className="mt-3 border-t border-white/10 pt-3">
                    {deliveries.length === 0 ? (
                      <p className="text-xs text-white/40">No deliveries yet.</p>
                    ) : (
                      <ul className="space-y-1">
                        {deliveries.map((d) => (
                          <li key={d.id} className="flex items-center justify-between text-xs">
                            <span className="font-mono text-white/60">{d.event}</span>
                            <span className="flex items-center gap-2">
                              <span
                                className={d.status === 'SUCCESS' ? 'text-green-400' : 'text-red-400'}
                              >
                                {d.status}
                                {d.statusCode ? ` ${d.statusCode}` : ''}
                              </span>
                              <span className="text-white/30">{timeAgo(d.createdAt)}</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
