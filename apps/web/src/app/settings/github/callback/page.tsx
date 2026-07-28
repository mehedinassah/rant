'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { github, getAccessToken } from '@/lib/api';

export default function GithubCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState('Finishing up…');
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    if (!getAccessToken()) {
      router.replace('/login');
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const installationId = params.get('installation_id');
    const code = params.get('code');
    const state = params.get('state') ?? '';

    (async () => {
      try {
        if (installationId) {
          // App installation redirect: state carries the org id.
          const orgId = decodeURIComponent(state);
          await github.completeInstall(orgId, installationId);
          setMessage('GitHub connected! Redirecting…');
          router.replace(`/orgs/${orgId}/integrations`);
          return;
        }
        if (code) {
          // OAuth redirect: link the account, return where we came from.
          await github.linkAccount(code);
          const back = window.localStorage.getItem('rant.github.return') ?? '/dashboard';
          window.localStorage.removeItem('rant.github.return');
          setMessage('GitHub account linked! Redirecting…');
          router.replace(back);
          return;
        }
        setMessage('Nothing to do — no installation or code in the callback.');
      } catch (err) {
        setMessage(err instanceof Error ? err.message : 'Something went wrong.');
      }
    })();
  }, [router]);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <div className="rounded-2xl border border-white/10 bg-[var(--color-ink-soft)] p-8 text-center">
        <p className="text-white/70">{message}</p>
      </div>
    </main>
  );
}
