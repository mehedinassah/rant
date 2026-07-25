'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  clearTokens,
  getAccessToken,
  organizations,
  type Organization,
} from '@/lib/api';

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
      <header className="mb-10 flex items-center justify-between">
        <h1 className="text-xl font-semibold">
          Your organizations
        </h1>
        <button onClick={signOut} className="text-sm text-white/60 hover:text-white">
          Sign out
        </button>
      </header>

      <form
        onSubmit={createOrg}
        className="mb-8 flex flex-wrap items-end gap-3 rounded-xl border border-white/10 bg-[var(--color-ink-soft)] p-4"
      >
        <label className="flex-1">
          <span className="mb-1 block text-xs text-white/50">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Acme Corp"
            required
            className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 outline-none focus:border-[var(--color-accent)]"
          />
        </label>
        <label className="flex-1">
          <span className="mb-1 block text-xs text-white/50">Slug</span>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="acme"
            required
            className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 outline-none focus:border-[var(--color-accent)]"
          />
        </label>
        <button
          type="submit"
          className="rounded-lg bg-[var(--color-accent)] px-4 py-2 font-medium text-white hover:opacity-90"
        >
          Create
        </button>
      </form>

      {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

      {loading ? (
        <p className="text-white/50">Loading…</p>
      ) : orgs.length === 0 ? (
        <p className="text-white/50">No organizations yet. Create your first one above.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {orgs.map((org) => (
            <li
              key={org.id}
              className="rounded-xl border border-white/10 bg-[var(--color-ink-soft)] p-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-medium">{org.name}</h3>
                {org.role && (
                  <span className="rounded-full bg-[var(--color-accent)]/20 px-2 py-0.5 text-xs text-[var(--color-accent-soft)]">
                    {org.role}
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-white/40">/{org.slug}</p>
              {org._count && (
                <p className="mt-3 text-xs text-white/40">
                  {org._count.memberships} members · {org._count.workspaces} workspaces
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
