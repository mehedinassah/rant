'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { github, type GithubAccount, type GithubStatus } from '@/lib/api';
import { useRequireAuth } from '@/lib/use-require-auth';

export default function IntegrationsPage() {
  const ready = useRequireAuth();
  const { orgId } = useParams<{ orgId: string }>();
  const [status, setStatus] = useState<GithubStatus | null>(null);
  const [account, setAccount] = useState<GithubAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, a] = await Promise.all([github.status(orgId), github.account()]);
      setStatus(s);
      setAccount(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  async function connect() {
    setBusy(true);
    setError(null);
    try {
      const { url } = await github.installUrl(orgId);
      window.location.href = url; // GitHub returns to /settings/github/callback
    } catch (err) {
      setError(err instanceof Error ? err.message : 'GitHub is not configured on this server');
      setBusy(false);
    }
  }

  async function linkAccount() {
    setBusy(true);
    setError(null);
    try {
      window.localStorage.setItem('rant.github.return', `/orgs/${orgId}/integrations`);
      const { url } = await github.oauthUrl();
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'GitHub OAuth is not configured');
      setBusy(false);
    }
  }

  async function resync() {
    setBusy(true);
    setError(null);
    try {
      await github.resync(orgId);
      setNotice('Sync queued — new data will appear shortly.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync');
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    setError(null);
    try {
      await github.disconnect(orgId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect');
    } finally {
      setBusy(false);
    }
  }

  async function unlink() {
    setBusy(true);
    try {
      await github.unlinkAccount();
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return null;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link href={`/orgs/${orgId}`} className="text-sm text-white/50 hover:text-white">
        ← Back to organization
      </Link>
      <h1 className="mt-3 text-2xl font-semibold">Integrations</h1>
      <p className="text-sm text-white/40">
        Connect external tools so real activity flows through rant&apos;s ripple.
      </p>

      {notice && <p className="mt-4 text-sm text-emerald-400">{notice}</p>}
      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      {loading ? (
        <p className="mt-8 text-white/50">Loading…</p>
      ) : (
        <section className="mt-6 rounded-xl border border-white/10 bg-[var(--color-ink-soft)] p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <span aria-hidden></span> GitHub
              </h2>
              <p className="mt-1 text-sm text-white/50">
                Sync repositories, commits, pull requests and Actions runs. A failed
                run opens an incident, posts to #activity and notifies your team —
                automatically.
              </p>
            </div>
            <span
              className={`shrink-0 rounded-full px-3 py-1 text-xs ${
                status?.connected ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/10 text-white/50'
              }`}
            >
              {status?.connected ? 'Connected' : 'Not connected'}
            </span>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            {status?.connected ? (
              <>
                <span className="text-sm text-white/60">
                  @{status.accountLogin} · {status.repoCount ?? 0} repo(s)
                  {status.syncedAt ? ` · synced ${new Date(status.syncedAt).toLocaleString()}` : ''}
                </span>
                <button
                  onClick={resync}
                  disabled={busy}
                  className="rounded-lg border border-white/10 px-3 py-1.5 text-sm hover:bg-white/10 disabled:opacity-50"
                >
                  Sync now
                </button>
                <button
                  onClick={disconnect}
                  disabled={busy}
                  className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-white/60 hover:bg-red-500/15 hover:text-red-300 disabled:opacity-50"
                >
                  Disconnect
                </button>
              </>
            ) : (
              <button
                onClick={connect}
                disabled={busy}
                className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                Connect GitHub
              </button>
            )}
          </div>

          <div className="mt-6 border-t border-white/5 pt-4">
            <p className="text-sm font-medium">Your GitHub account</p>
            <p className="text-sm text-white/40">
              Link your account so your commits and PRs map to you in rant.
            </p>
            <div className="mt-3">
              {account?.linked ? (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-white/70">Linked as @{account.login}</span>
                  <button
                    onClick={unlink}
                    disabled={busy}
                    className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/60 hover:bg-white/10 disabled:opacity-50"
                  >
                    Unlink
                  </button>
                </div>
              ) : (
                <button
                  onClick={linkAccount}
                  disabled={busy}
                  className="rounded-lg border border-white/10 px-3 py-1.5 text-sm hover:bg-white/10 disabled:opacity-50"
                >
                  Link my GitHub account
                </button>
              )}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
