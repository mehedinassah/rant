'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { organizations, repositories, type Organization, type Repository } from '@/lib/api';
import { useRequireAuth } from '@/lib/use-require-auth';

export default function ReposPage() {
  const ready = useRequireAuth();
  const { orgId } = useParams<{ orgId: string }>();
  const [org, setOrg] = useState<Organization | null>(null);
  const [repos, setRepos] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [o, r] = await Promise.all([organizations.get(orgId), repositories.list(orgId)]);
      setOrg(o);
      setRepos(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  async function createRepo(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      await repositories.create(orgId, { name, slug });
      setName('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create repository');
    }
  }

  if (!ready) return null;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <Link href={`/orgs/${orgId}`} className="text-sm text-white/50 hover:text-white">
        ← {org?.name ?? 'Organization'}
      </Link>
      <h1 className="mt-3 text-2xl font-semibold">Repositories</h1>
      <p className="text-sm text-white/40">Source, pull requests and CI/CD pipelines.</p>

      <form onSubmit={createRepo} className="mt-8 flex gap-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New repository name"
          required
          className="flex-1 rounded-lg border border-white/10 bg-[var(--color-ink-soft)] px-3 py-2 outline-none focus:border-[var(--color-accent)]"
        />
        <button className="rounded-lg bg-[var(--color-accent)] px-4 py-2 font-medium text-white hover:opacity-90">
          Create repository
        </button>
      </form>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      {loading ? (
        <p className="mt-8 text-white/50">Loading…</p>
      ) : repos.length === 0 ? (
        <p className="mt-8 text-white/50">No repositories yet. Create one above.</p>
      ) : (
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {repos.map((r) => (
            <Link
              key={r.id}
              href={`/orgs/${orgId}/repos/${r.id}`}
              className="rounded-xl border border-white/10 bg-[var(--color-ink-soft)] p-4 transition hover:border-[var(--color-accent)]/50 hover:bg-white/5"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-medium">{r.name}</h3>
                <span className="rounded bg-white/10 px-1.5 py-0.5 text-xs text-white/60">
                  {r.visibility.toLowerCase()}
                </span>
              </div>
              {r.description && <p className="mt-1 text-sm text-white/50">{r.description}</p>}
              <div className="mt-3 flex gap-4 text-xs text-white/40">
                <span>⑃ {r._count?.pullRequests ?? 0} PRs</span>
                <span>◇ {r._count?.commits ?? 0} commits</span>
                <span className="font-mono">{r.defaultBranch}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
