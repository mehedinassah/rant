'use client';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import {
  search as searchApi,
  SEARCH_TYPE_META,
  type SavedSearch,
  type SearchResponse,
} from '@/lib/api';
import { useRequireAuth } from '@/lib/use-require-auth';

function SearchInner() {
  const ready = useRequireAuth();
  const router = useRouter();
  const params = useSearchParams();
  const { orgId } = useParams<{ orgId: string }>();
  const initialQ = params.get('q') ?? '';

  const [q, setQ] = useState(initialQ);
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [saved, setSaved] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const doSearch = useCallback(
    async (query: string) => {
      const trimmed = query.trim();
      if (!trimmed) {
        setResults(null);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        setResults(await searchApi.run(orgId, trimmed));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Search failed');
      } finally {
        setLoading(false);
      }
    },
    [orgId],
  );

  const loadSaved = useCallback(async () => {
    try {
      setSaved(await searchApi.listSaved(orgId));
    } catch {
      /* ignore */
    }
  }, [orgId]);

  useEffect(() => {
    if (!ready) return;
    void loadSaved();
    if (initialQ) void doSearch(initialQ);
  }, [ready, initialQ, doSearch, loadSaved]);

  // Debounced live search as you type.
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => {
      const usp = new URLSearchParams(q ? { q } : {});
      router.replace(`/orgs/${orgId}/search${q ? `?${usp.toString()}` : ''}`);
      void doSearch(q);
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, ready]);

  async function saveCurrent() {
    if (!q.trim()) return;
    const name = prompt('Name this search:', q.trim());
    if (!name) return;
    try {
      await searchApi.createSaved(orgId, { name, query: q.trim() });
      await loadSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    }
  }

  async function removeSaved(id: string) {
    await searchApi.removeSaved(orgId, id).catch(() => undefined);
    await loadSaved();
  }

  if (!ready) return null;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link href={`/orgs/${orgId}`} className="text-sm text-white/50 hover:text-white">
        ← Organization
      </Link>
      <h1 className="mt-3 text-2xl font-semibold">Search</h1>
      <p className="text-sm text-white/40">
        One box across issues, projects, repos, pull requests, docs and incidents.
      </p>

      <div className="mt-5 flex gap-2">
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search everything…"
          className="flex-1 rounded-lg border border-white/10 bg-[var(--color-ink-soft)] px-4 py-2.5 outline-none focus:border-[var(--color-accent)]"
        />
        {q.trim() && (
          <button
            onClick={saveCurrent}
            className="rounded-lg border border-white/15 px-3 py-2.5 text-sm hover:bg-white/10"
          >
            ☆ Save
          </button>
        )}
      </div>

      {saved.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {saved.map((s) => (
            <span
              key={s.id}
              className="group inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs"
            >
              <button onClick={() => setQ(s.query)} className="hover:text-white" title={s.query}>
                {s.name}
              </button>
              <button onClick={() => removeSaved(s.id)} className="text-white/30 hover:text-red-400">
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      <div className="mt-6">
        {loading && <p className="text-white/50">Searching…</p>}
        {!loading && results && results.total === 0 && (
          <p className="text-white/50">No matches for “{results.query}”.</p>
        )}
        {!loading && results && results.total > 0 && (
          <div className="space-y-6">
            <p className="text-xs uppercase tracking-wide text-white/40">
              {results.total} result{results.total > 1 ? 's' : ''}
            </p>
            {results.groups.map((group) => (
              <section key={group.type}>
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-white/50">
                  {group.label}{' '}
                  <span className="text-white/30">({group.results.length})</span>
                </h2>
                <div className="overflow-hidden rounded-xl border border-white/10">
                  {group.results.map((r, i) => {
                    const meta = SEARCH_TYPE_META[r.type];
                    return (
                      <Link
                        key={r.id}
                        href={r.linkPath}
                        className={`flex items-start gap-3 px-4 py-3 transition hover:bg-white/5 ${
                          i > 0 ? 'border-t border-white/10' : ''
                        }`}
                      >
                        <span
                          className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded text-xs"
                          style={{ color: meta.color, background: `${meta.color}1a` }}
                        >
                          {meta.icon}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-medium">{r.title}</span>
                            {r.subtitle && (
                              <span className="shrink-0 text-xs text-white/40">{r.subtitle}</span>
                            )}
                          </div>
                          {r.snippet && (
                            <p className="mt-0.5 line-clamp-2 text-sm text-white/50">{r.snippet}</p>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-3xl px-6 py-10 text-white/50">Loading…</main>}>
      <SearchInner />
    </Suspense>
  );
}
