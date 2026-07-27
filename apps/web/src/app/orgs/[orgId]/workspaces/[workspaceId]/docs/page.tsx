'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import {
  docs as docsApi,
  type DocDetail,
  type DocRevisionSummary,
  type DocSummary,
} from '@/lib/api';
import { renderMarkdown } from '@/lib/markdown';
import { useRequireAuth } from '@/lib/use-require-auth';

interface TreeNode extends DocSummary {
  children: TreeNode[];
}

function buildTree(flat: DocSummary[]): TreeNode[] {
  const byId = new Map<string, TreeNode>();
  flat.forEach((d) => byId.set(d.id, { ...d, children: [] }));
  const roots: TreeNode[] = [];
  byId.forEach((node) => {
    if (node.parentId && byId.has(node.parentId)) byId.get(node.parentId)!.children.push(node);
    else roots.push(node);
  });
  return roots;
}

function timeAgo(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function DocsInner() {
  const ready = useRequireAuth();
  const { orgId, workspaceId } = useParams<{ orgId: string; workspaceId: string }>();
  const searchParams = useSearchParams();
  const docParam = searchParams.get('doc');
  const [flat, setFlat] = useState<DocSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [doc, setDoc] = useState<DocDetail | null>(null);
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftContent, setDraftContent] = useState('');
  const [revisions, setRevisions] = useState<DocRevisionSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const tree = useMemo(() => buildTree(flat), [flat]);

  const loadTree = useCallback(async () => {
    try {
      setFlat(await docsApi.list(orgId, workspaceId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    }
  }, [orgId, workspaceId]);

  useEffect(() => {
    if (ready) void loadTree();
  }, [ready, loadTree]);

  const selectDoc = useCallback(
    async (id: string) => {
      setSelectedId(id);
      setEditing(false);
      setRevisions(null);
      try {
        const d = await docsApi.get(orgId, workspaceId, id);
        setDoc(d);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to open');
      }
    },
    [orgId, workspaceId],
  );

  // Deep-link support: /docs?doc=<id> opens that page (e.g. from search).
  useEffect(() => {
    if (ready && docParam && docParam !== selectedId) void selectDoc(docParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, docParam]);

  async function createPage(parentId?: string | null) {
    setBusy(true);
    setError(null);
    try {
      const d = await docsApi.create(orgId, workspaceId, { title: 'Untitled', parentId: parentId ?? null });
      await loadTree();
      setDoc(d);
      setSelectedId(d.id);
      setDraftTitle(d.title);
      setDraftContent(d.content);
      setEditing(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create');
    } finally {
      setBusy(false);
    }
  }

  function startEdit() {
    if (!doc) return;
    setDraftTitle(doc.title);
    setDraftContent(doc.content);
    setEditing(true);
  }

  async function save() {
    if (!doc) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await docsApi.update(orgId, workspaceId, doc.id, {
        title: draftTitle,
        content: draftContent,
      });
      setDoc(updated);
      setEditing(false);
      await loadTree();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!doc || !confirm(`Delete "${doc.title}" and all its sub-pages?`)) return;
    setBusy(true);
    try {
      await docsApi.remove(orgId, workspaceId, doc.id);
      setDoc(null);
      setSelectedId(null);
      await loadTree();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setBusy(false);
    }
  }

  async function openHistory() {
    if (!doc) return;
    try {
      setRevisions(await docsApi.revisions(orgId, workspaceId, doc.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load history');
    }
  }

  async function restore(revisionId: string) {
    if (!doc || !confirm('Restore this version? The current version is saved to history first.')) return;
    setBusy(true);
    try {
      const updated = await docsApi.restore(orgId, workspaceId, doc.id, revisionId);
      setDoc(updated);
      setRevisions(null);
      await loadTree();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restore');
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return null;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <Link href={`/orgs/${orgId}`} className="text-sm text-white/50 hover:text-white">
        ← Organization
      </Link>
      <h1 className="mt-3 text-2xl font-semibold">Documentation</h1>
      <p className="text-sm text-white/40">A workspace knowledge base with full version history.</p>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-[260px_1fr]">
        {/* Sidebar tree */}
        <aside className="rounded-xl border border-white/10 bg-[var(--color-ink-soft)] p-3">
          <button
            onClick={() => createPage(null)}
            disabled={busy}
            className="mb-2 w-full rounded-lg bg-white/10 px-3 py-1.5 text-sm font-medium hover:bg-white/20 disabled:opacity-50"
          >
            + New page
          </button>
          {tree.length === 0 ? (
            <p className="px-2 py-4 text-sm text-white/30">No pages yet.</p>
          ) : (
            <ul className="space-y-0.5">
              {tree.map((node) => (
                <TreeItem
                  key={node.id}
                  node={node}
                  depth={0}
                  selectedId={selectedId}
                  onSelect={selectDoc}
                  onAddChild={(pid) => createPage(pid)}
                />
              ))}
            </ul>
          )}
        </aside>

        {/* Main pane */}
        <section className="min-h-[24rem] rounded-xl border border-white/10 bg-[var(--color-ink-soft)] p-6">
          {!doc ? (
            <div className="flex h-full items-center justify-center text-white/40">
              Select a page, or create one.
            </div>
          ) : revisions ? (
            <div>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Version history</h2>
                <button
                  onClick={() => setRevisions(null)}
                  className="rounded-lg border border-white/15 px-3 py-1.5 text-sm hover:bg-white/10"
                >
                  ← Back
                </button>
              </div>
              {revisions.length === 0 ? (
                <p className="mt-4 text-sm text-white/40">No prior versions yet — edit the page to create history.</p>
              ) : (
                <ul className="mt-4 space-y-2">
                  {revisions.map((rev) => (
                    <li
                      key={rev.id}
                      className="flex items-center justify-between rounded-lg border border-white/10 px-3 py-2"
                    >
                      <div className="text-sm">
                        <span className="font-medium">{rev.title}</span>
                        <span className="ml-2 text-xs text-white/40">
                          {rev.editedBy?.name ?? 'someone'} · {timeAgo(rev.createdAt)}
                        </span>
                      </div>
                      <button
                        onClick={() => restore(rev.id)}
                        disabled={busy}
                        className="rounded-lg border border-white/15 px-3 py-1 text-xs hover:bg-white/10 disabled:opacity-50"
                      >
                        Restore
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : editing ? (
            <div>
              <input
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                placeholder="Page title"
                className="w-full bg-transparent text-2xl font-semibold outline-none"
              />
              <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                <textarea
                  value={draftContent}
                  onChange={(e) => setDraftContent(e.target.value)}
                  placeholder="Write in Markdown…"
                  className="h-[26rem] w-full resize-none rounded-lg border border-white/10 bg-black/30 p-3 font-mono text-sm outline-none focus:border-[var(--color-accent)]"
                />
                <div
                  className="prose-invert h-[26rem] overflow-auto rounded-lg border border-white/10 p-3 text-sm"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(draftContent) }}
                />
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={save}
                  disabled={busy}
                  className="rounded-lg bg-[var(--color-accent)] px-4 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                >
                  {busy ? 'Saving…' : 'Save'}
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="rounded-lg border border-white/15 px-4 py-1.5 text-sm hover:bg-white/10"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-start justify-between">
                <h2 className="text-2xl font-semibold">
                  {doc.icon && <span className="mr-2">{doc.icon}</span>}
                  {doc.title}
                </h2>
                <div className="flex shrink-0 gap-2">
                  <button onClick={startEdit} className="rounded-lg bg-white/10 px-3 py-1.5 text-sm font-medium hover:bg-white/20">
                    Edit
                  </button>
                  <button onClick={openHistory} className="rounded-lg border border-white/15 px-3 py-1.5 text-sm hover:bg-white/10">
                    History{doc._count ? ` (${doc._count.revisions})` : ''}
                  </button>
                  <button onClick={remove} className="rounded-lg border border-white/15 px-3 py-1.5 text-sm text-red-300 hover:bg-red-500/10">
                    Delete
                  </button>
                </div>
              </div>
              <p className="mt-1 text-xs text-white/40">
                Last edited by {doc.lastEditedBy?.name ?? doc.author.name} · {timeAgo(doc.updatedAt)}
              </p>
              {doc.content.trim() === '' ? (
                <p className="mt-6 text-white/30">This page is empty. Click Edit to add content.</p>
              ) : (
                <div
                  className="mt-6 text-sm text-white/80"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(doc.content) }}
                />
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

export default function DocsPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-6xl px-6 py-10 text-white/50">Loading…</main>}>
      <DocsInner />
    </Suspense>
  );
}

function TreeItem({
  node,
  depth,
  selectedId,
  onSelect,
  onAddChild,
}: {
  node: TreeNode;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAddChild: (parentId: string) => void;
}) {
  return (
    <li>
      <div
        className={`group flex items-center justify-between rounded-lg px-2 py-1.5 text-sm ${
          selectedId === node.id ? 'bg-white/10' : 'hover:bg-white/5'
        }`}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
      >
        <button onClick={() => onSelect(node.id)} className="flex-1 truncate text-left">
          <span className="mr-1.5">{node.icon ?? '📄'}</span>
          {node.title}
        </button>
        <button
          onClick={() => onAddChild(node.id)}
          className="ml-1 shrink-0 rounded px-1 text-white/30 opacity-0 hover:text-white group-hover:opacity-100"
          title="Add sub-page"
        >
          +
        </button>
      </div>
      {node.children.length > 0 && (
        <ul className="space-y-0.5">
          {node.children.map((child) => (
            <TreeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              onAddChild={onAddChild}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
