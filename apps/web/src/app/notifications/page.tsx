'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  notifications as notificationsApi,
  streamNotifications,
  NOTIFICATION_CATEGORY_META,
  NOTIFICATION_META,
  type Notification,
  type NotificationPreference,
} from '@/lib/api';
import { useRequireAuth } from '@/lib/use-require-auth';

function timeAgo(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function NotificationsPage() {
  const ready = useRequireAuth();
  const router = useRouter();
  const [items, setItems] = useState<Notification[]>([]);
  const [prefs, setPrefs] = useState<NotificationPreference[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPrefs, setShowPrefs] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [list, p] = await Promise.all([
        notificationsApi.list(),
        notificationsApi.getPreferences(),
      ]);
      setItems(list);
      setPrefs(p);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  // Keep the feed live.
  useEffect(() => {
    if (!ready) return;
    const stop = streamNotifications((snap) => setItems(snap.latest));
    return () => stop();
  }, [ready]);

  async function open(n: Notification) {
    if (!n.readAt) {
      await notificationsApi.markRead(n.id).catch(() => undefined);
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)));
    }
    if (n.linkPath) router.push(n.linkPath);
  }

  async function markAllRead() {
    await notificationsApi.markAllRead();
    await load();
  }

  async function togglePref(category: string, field: 'inApp' | 'email', value: boolean) {
    const next = prefs.map((p) => (p.category === category ? { ...p, [field]: value } : p));
    setPrefs(next);
    await notificationsApi.updatePreferences(next).catch(() => undefined);
  }

  if (!ready) return null;

  const unread = items.filter((n) => !n.readAt).length;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/dashboard" className="text-sm text-white/50 hover:text-white">
        ← Dashboard
      </Link>

      <div className="mt-3 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Notifications</h1>
          <p className="text-sm text-white/40">
            {unread > 0 ? `${unread} unread` : 'All caught up'}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowPrefs((v) => !v)}
            className="rounded-lg border border-white/15 px-3 py-1.5 text-sm hover:bg-white/10"
          >
            {showPrefs ? 'Done' : 'Preferences'}
          </button>
          {unread > 0 && (
            <button
              onClick={markAllRead}
              className="rounded-lg bg-white/10 px-3 py-1.5 text-sm font-medium hover:bg-white/20"
            >
              Mark all read
            </button>
          )}
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      {showPrefs && (
        <section className="mt-6 rounded-xl border border-white/10 bg-[var(--color-ink-soft)] p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-white/50">
            Delivery preferences
          </h2>
          <div className="mt-3 space-y-3">
            {prefs.map((p) => {
              const meta = NOTIFICATION_CATEGORY_META[p.category];
              return (
                <div key={p.category} className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">{meta.label}</div>
                    <div className="text-xs text-white/40">{meta.description}</div>
                  </div>
                  <div className="flex gap-4 text-sm">
                    <label className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={p.inApp}
                        onChange={(e) => togglePref(p.category, 'inApp', e.target.checked)}
                      />
                      In-app
                    </label>
                    <label className="flex items-center gap-1.5 text-white/60">
                      <input
                        type="checkbox"
                        checked={p.email}
                        onChange={(e) => togglePref(p.category, 'email', e.target.checked)}
                      />
                      Email
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-white/30">
            Email delivery is simulated for now (logged server-side).
          </p>
        </section>
      )}

      {loading ? (
        <p className="mt-8 text-white/50">Loading…</p>
      ) : items.length === 0 ? (
        <p className="mt-8 text-white/50">No notifications yet.</p>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-white/10">
          {items.map((n, i) => {
            const meta = NOTIFICATION_META[n.type];
            return (
              <button
                key={n.id}
                onClick={() => open(n)}
                className={`flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-white/5 ${
                  i > 0 ? 'border-t border-white/10' : ''
                } ${n.readAt ? 'opacity-60' : ''}`}
              >
                <span
                  className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs"
                  style={{ color: meta.color, background: `${meta.color}1a` }}
                >
                  {meta.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{n.title}</span>
                    {!n.readAt && (
                      <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--color-accent)]" />
                    )}
                  </div>
                  {n.body && <p className="truncate text-sm text-white/50">{n.body}</p>}
                  <p className="mt-0.5 text-xs text-white/30">{timeAgo(n.createdAt)}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </main>
  );
}
