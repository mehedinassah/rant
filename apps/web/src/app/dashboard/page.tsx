'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  clearTokens,
  getAccessToken,
  organizations,
  type Organization,
} from '@/lib/api';
import { NotificationBell } from '@/components/notification-bell';

export default function DashboardPage() {
  const router = useRouter();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace('/login');
      return;
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    try {
      setOrgs(await organizations.list());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  async function createOrg(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await organizations.create({ name, slug });
      setName('');
      setSlug('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create');
    }
  }

  function signOut() {
    clearTokens();
    router.push('/login');
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between border-b-2 border-white/20 pb-3">
        <p className="brutal-kicker">rant // control plane</p>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">
          {orgs.length} org{orgs.length === 1 ? '' : 's'} · local
        </span>
      </div>

      <header className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl sm:text-5xl">Your organizations</h1>
          <p className="mt-2 max-w-lg font-mono text-xs leading-relaxed text-white/50">
            Pick a workspace. Everything after this point is one connected system.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <NotificationBell />
          <button
            onClick={signOut}
            className="border border-white/20 px-3 py-2 text-xs text-white/60 hover:text-white"
          >
            Sign out
          </button>
        </div>
      </header>

      <form
        onSubmit={createOrg}
        className="mb-8 border-2 border-white/20 bg-[var(--color-ink-soft)] p-4"
      >
        <p className="brutal-kicker mb-3">New organization</p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex-1">
            <span className="mb-1.5 block font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">
              Name
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme Corp"
              required
              className="w-full px-3 py-2 text-sm"
            />
          </label>
          <label className="flex-1">
            <span className="mb-1.5 block font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">
              Slug
            </span>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="acme"
              required
              className="w-full px-3 py-2 text-sm"
            />
          </label>
          <button
            type="submit"
            className="bg-[var(--color-accent)] px-4 py-2 text-sm text-white"
          >
            Create
          </button>
        </div>
      </form>

      {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

      {loading ? (
        <p className="font-mono text-xs uppercase tracking-widest text-white/40">Loading…</p>
      ) : orgs.length === 0 ? (
        <p className="text-white/50">No organizations yet. Create your first one above.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {orgs.map((org, index) => (
            <li key={org.id}>
              <Link
                href={`/orgs/${org.id}`}
                className="group relative block border-2 border-white/20 bg-[var(--color-ink-soft)] p-4 pb-10 transition hover:border-[var(--color-accent)]/50 hover:bg-white/5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/35">
                    {String(index + 1).padStart(2, '0')} / ORG
                  </span>
                  {org.role && (
                    <span className="border border-[var(--color-accent)] px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--color-accent)]">
                      {org.role}
                    </span>
                  )}
                </div>
                <h3 className="mt-3 text-lg">{org.name}</h3>
                <p className="mt-1 font-mono text-xs text-white/40">/{org.slug}</p>
                {org._count && (
                  <p className="mt-3 font-mono text-[10px] uppercase tracking-wider text-white/40">
                    {org._count.memberships} members · {org._count.workspaces} workspaces
                  </p>
                )}
                <span className="absolute bottom-3 right-3 font-mono text-[10px] uppercase tracking-widest text-white/40 transition group-hover:text-[var(--color-accent)]">
                  Open ↗
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
