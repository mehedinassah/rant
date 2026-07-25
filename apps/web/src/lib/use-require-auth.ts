'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getAccessToken } from './api';

/** Client-side guard: redirects to /login when no access token is present. */
export function useRequireAuth(): boolean {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace('/login');
    } else {
      setReady(true);
    }
  }, [router]);

  return ready;
}
