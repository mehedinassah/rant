'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  invitations as invitesApi,
  organizations,
  ORG_ROLES,
  type Invitation,
  type Member,
} from '@/lib/api';
import { useRequireAuth } from '@/lib/use-require-auth';

const STATUS_STYLES: Record<Invitation['status'], string> = {
  PENDING: 'bg-amber-500/15 text-amber-300',
  ACCEPTED: 'bg-emerald-500/15 text-emerald-300',
  REVOKED: 'bg-white/10 text-white/50',
  EXPIRED: 'bg-red-500/15 text-red-300',
};

export default function MembersPage() {
  const ready = useRequireAuth();
  const { orgId } = useParams<{ orgId: string }>();
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invitation[]>([]);
  const [canManage, setCanManage] = useState(true);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<string>('DEVELOPER');
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const mem = await organizations.members(orgId);
      setMembers(mem);
      try {
        setInvites(await invitesApi.list(orgId));
        setCanManage(true);
      } catch {
        // Non-managers can view the roster but not the invitation pipeline.
        setCanManage(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    try {
      const inv = await invitesApi.create(orgId, { email: email.trim(), role });
      setNotice(`Invitation emailed to ${inv.email}.`);
      setEmail('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invitation');
    }
  }

  async function revoke(id: string) {
    setError(null);
    try {
      await invitesApi.revoke(orgId, id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke');
    }
  }

  async function changeRole(userId: string, newRole: string) {
    setError(null);
    try {
      await organizations.updateMemberRole(orgId, userId, newRole);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change role');
    }
  }

  async function remove(userId: string) {
    setError(null);
    try {
      await organizations.removeMember(orgId, userId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove member');
    }
  }

  if (!ready) return null;

  const pending = invites.filter((i) => i.status === 'PENDING');
  const past = invites.filter((i) => i.status !== 'PENDING');

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Link href={`/orgs/${orgId}`} className="text-sm text-white/50 hover:text-white">
        ← Back to organization
      </Link>
      <h1 className="mt-3 text-2xl font-semibold">Members</h1>
      <p className="text-sm text-white/40">Manage who belongs to this organization and invite new teammates.</p>

      {canManage && (
        <form onSubmit={invite} className="mt-6 flex flex-col gap-3 rounded-xl border border-white/10 bg-[var(--color-ink-soft)] p-4 sm:flex-row">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="teammate@company.com"
            required
            className="flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 outline-none focus:border-[var(--color-accent)]"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 outline-none focus:border-[var(--color-accent)]"
          >
            {ORG_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <button className="rounded-lg bg-[var(--color-accent)] px-4 py-2 font-medium text-white hover:opacity-90">
            Send invite
          </button>
        </form>
      )}

      {notice && <p className="mt-4 text-sm text-emerald-400">{notice}</p>}
      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      {loading ? (
        <p className="mt-8 text-white/50">Loading…</p>
      ) : (
        <>
          <section className="mt-8">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-white/50">
              {members.length} member{members.length === 1 ? '' : 's'}
            </h2>
            <ul className="mt-3 divide-y divide-white/5 rounded-xl border border-white/10">
              {members.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{m.user.name}</p>
                    <p className="truncate text-sm text-white/40">{m.user.email}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {canManage && m.role !== 'OWNER' ? (
                      <>
                        <select
                          value={m.role}
                          onChange={(e) => changeRole(m.user.id, e.target.value)}
                          className="rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-xs outline-none focus:border-[var(--color-accent)]"
                        >
                          {ORG_ROLES.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => remove(m.user.id)}
                          className="rounded-lg border border-white/10 px-2 py-1 text-xs text-white/50 hover:bg-red-500/15 hover:text-red-300"
                        >
                          Remove
                        </button>
                      </>
                    ) : (
                      <span className="rounded bg-white/10 px-2 py-0.5 text-xs text-white/70">{m.role}</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {canManage && pending.length > 0 && (
            <section className="mt-8">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-white/50">
                Pending invitations
              </h2>
              <ul className="mt-3 divide-y divide-white/5 rounded-xl border border-white/10">
                {pending.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{i.email}</p>
                      <p className="text-sm text-white/40">
                        {i.role} · invited by {i.invitedBy?.name ?? 'someone'} · expires{' '}
                        {new Date(i.expiresAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className={`rounded px-2 py-0.5 text-xs ${STATUS_STYLES[i.status]}`}>
                        {i.status}
                      </span>
                      <button
                        onClick={() => revoke(i.id)}
                        className="rounded-lg border border-white/10 px-2 py-1 text-xs text-white/50 hover:bg-red-500/15 hover:text-red-300"
                      >
                        Revoke
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {canManage && past.length > 0 && (
            <section className="mt-8">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-white/50">History</h2>
              <ul className="mt-3 divide-y divide-white/5 rounded-xl border border-white/10 text-sm">
                {past.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <span className="truncate text-white/60">{i.email}</span>
                    <span className={`rounded px-2 py-0.5 text-xs ${STATUS_STYLES[i.status]}`}>
                      {i.status}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </main>
  );
}
