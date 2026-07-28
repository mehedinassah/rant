'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  getAccessToken,
  invitations as invitesApi,
  type InvitationPreview,
} from '@/lib/api';

export default function InviteAcceptPage() {
  const router = useRouter();
  const { token } = useParams<{ token: string }>();
  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    setAuthed(Boolean(getAccessToken()));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPreview(await invitesApi.preview(token));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invitation not found');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function accept() {
    setAccepting(true);
    setError(null);
    try {
      const res = await invitesApi.accept(token);
      router.push(`/orgs/${res.organizationId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept');
      setAccepting(false);
    }
  }

  const redirectTarget = `/invite/${token}`;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
      <div className="rounded-2xl border border-white/10 bg-[var(--color-ink-soft)] p-8">
        {loading ? (
          <p className="text-white/50">Loading invitation…</p>
        ) : !preview ? (
          <>
            <h1 className="text-xl font-semibold">Invitation unavailable</h1>
            <p className="mt-2 text-sm text-white/50">{error ?? 'This invitation could not be found.'}</p>
            <Link href="/dashboard" className="mt-6 inline-block text-sm text-[var(--color-accent-soft)] hover:underline">
              Go to dashboard
            </Link>
          </>
        ) : preview.status !== 'PENDING' || preview.expired ? (
          <>
            <h1 className="text-xl font-semibold">This invitation is no longer active</h1>
            <p className="mt-2 text-sm text-white/50">
              {preview.expired
                ? 'It has expired. Ask an admin to send a new one.'
                : `Status: ${preview.status.toLowerCase()}.`}
            </p>
            <Link href="/dashboard" className="mt-6 inline-block text-sm text-[var(--color-accent-soft)] hover:underline">
              Go to dashboard
            </Link>
          </>
        ) : (
          <>
            <p className="text-sm text-white/40">You&apos;ve been invited to join</p>
            <h1 className="mt-1 text-2xl font-semibold">{preview.organizationName}</h1>
            <p className="mt-3 text-sm text-white/60">
              Role: <span className="rounded bg-white/10 px-2 py-0.5 text-white/80">{preview.role}</span>
            </p>
            <p className="mt-1 text-sm text-white/40">Invitation sent to {preview.email}</p>

            {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

            {authed ? (
              <button
                onClick={accept}
                disabled={accepting}
                className="mt-6 w-full rounded-lg bg-[var(--color-accent)] py-2.5 font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {accepting ? 'Joining…' : 'Accept invitation'}
              </button>
            ) : (
              <div className="mt-6 space-y-3">
                <p className="text-sm text-white/50">
                  Sign in or create an account with <strong>{preview.email}</strong> to accept.
                </p>
                <Link
                  href={`/login?redirect=${encodeURIComponent(redirectTarget)}`}
                  className="block w-full rounded-lg bg-[var(--color-accent)] py-2.5 text-center font-medium text-white hover:opacity-90"
                >
                  Sign in
                </Link>
                <Link
                  href={`/register?redirect=${encodeURIComponent(redirectTarget)}`}
                  className="block w-full rounded-lg border border-white/15 py-2.5 text-center font-medium text-white/80 hover:bg-white/5"
                >
                  Create account
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
