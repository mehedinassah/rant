'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  organizations,
  projects as projectsApi,
  workspaces as workspacesApi,
  type Organization,
  type Project,
  type Workspace,
} from '@/lib/api';
import { useRequireAuth } from '@/lib/use-require-auth';
import { NotificationBell } from '@/components/notification-bell';

interface WorkspaceWithProjects extends Workspace {
  projects: Project[];
}

export default function OrgPage() {
  const ready = useRequireAuth();
  const { orgId } = useParams<{ orgId: string }>();
  const [org, setOrg] = useState<Organization | null>(null);
  const [items, setItems] = useState<WorkspaceWithProjects[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wsName, setWsName] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [o, ws] = await Promise.all([organizations.get(orgId), workspacesApi.list(orgId)]);
      setOrg(o);
      const withProjects = await Promise.all(
        ws.map(async (w) => ({ ...w, projects: await projectsApi.list(orgId, w.id) })),
      );
      setItems(withProjects);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  async function createWorkspace(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const slug = wsName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      await workspacesApi.create(orgId, { name: wsName, slug });
      setWsName('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create workspace');
    }
  }

  if (!ready) return null;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex items-start justify-between">
        <Link href="/dashboard" className="text-sm text-white/50 hover:text-white">
          ← All organizations
        </Link>
        <NotificationBell />
      </div>
      <h1 className="mt-3 text-2xl font-semibold">{org?.name ?? 'Organization'}</h1>
      <p className="text-sm text-white/40">/{org?.slug}</p>

      <nav className="mt-5 flex gap-2">
        <span className="rounded-lg bg-white/10 px-3 py-1.5 text-sm font-medium">Projects</span>
        <Link
          href={`/orgs/${orgId}/repos`}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-white/60 hover:bg-white/5 hover:text-white"
        >
          Repositories &amp; CI
        </Link>
      </nav>

      <form onSubmit={createWorkspace} className="mt-8 flex gap-3">
        <input
          value={wsName}
          onChange={(e) => setWsName(e.target.value)}
          placeholder="New workspace name"
          required
          className="flex-1 rounded-lg border border-white/10 bg-[var(--color-ink-soft)] px-3 py-2 outline-none focus:border-[var(--color-accent)]"
        />
        <button className="rounded-lg bg-[var(--color-accent)] px-4 py-2 font-medium text-white hover:opacity-90">
          Add workspace
        </button>
      </form>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      {loading ? (
        <p className="mt-8 text-white/50">Loading…</p>
      ) : items.length === 0 ? (
        <p className="mt-8 text-white/50">No workspaces yet. Create one above.</p>
      ) : (
        <div className="mt-8 space-y-8">
          {items.map((ws) => (
            <WorkspaceSection key={ws.id} orgId={orgId} ws={ws} onChanged={load} />
          ))}
        </div>
      )}
    </main>
  );
}

function WorkspaceSection({
  orgId,
  ws,
  onChanged,
}: {
  orgId: string;
  ws: WorkspaceWithProjects;
  onChanged: () => void | Promise<void>;
}) {
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await projectsApi.create(orgId, ws.id, { name, key: key.toUpperCase() });
      setName('');
      setKey('');
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    }
  }

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-white/50">
          {ws.name}
        </h2>
        <Link
          href={`/orgs/${orgId}/workspaces/${ws.id}/docs`}
          className="text-xs font-medium text-white/50 hover:text-white"
        >
          📖 Docs →
        </Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ws.projects.map((p) => (
          <Link
            key={p.id}
            href={`/orgs/${orgId}/workspaces/${ws.id}/projects/${p.id}`}
            className="rounded-xl border border-white/10 bg-[var(--color-ink-soft)] p-4 transition hover:border-[var(--color-accent)]/50 hover:bg-white/5"
          >
            <div className="flex items-center justify-between">
              <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs text-white/70">
                {p.key}
              </span>
              <span className="text-xs text-white/40">{p.status}</span>
            </div>
            <h3 className="mt-2 font-medium">{p.name}</h3>
          </Link>
        ))}
        <form
          onSubmit={createProject}
          className="flex flex-col gap-2 rounded-xl border border-dashed border-white/15 p-4"
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Project name"
            required
            className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm outline-none focus:border-[var(--color-accent)]"
          />
          <input
            value={key}
            onChange={(e) => setKey(e.target.value.toUpperCase())}
            placeholder="KEY"
            required
            maxLength={10}
            className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 font-mono text-sm outline-none focus:border-[var(--color-accent)]"
          />
          <button className="rounded-lg bg-white/10 py-1.5 text-sm font-medium hover:bg-white/20">
            + New project
          </button>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </form>
      </div>
    </section>
  );
}
