'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getAccessToken, streamNotifications } from '@/lib/api';
import { connectRealtime, onRealtime, type NotificationCreatedEvent } from '@/lib/realtime';

/**
 * A bell that links to the notification center and keeps its unread badge live.
 * The Socket.IO push makes it instant; the SSE stream remains a fallback for
 * environments where WebSockets are blocked by a proxy.
 */
export function NotificationBell() {
  const [unread, setUnread] = useState(0);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    if (!getAccessToken()) return;
    setAuthed(true);
    connectRealtime();
    const stop = streamNotifications((snap) => setUnread(snap.unread));
    const stopRealtime = onRealtime<NotificationCreatedEvent>('notification.created', () => {
      setUnread((n) => n + 1);
    });
    return () => {
      stop();
      stopRealtime();
    };
  }, []);

  if (!authed) return null;

  return (
    <Link
      href="/notifications"
      aria-label={`Notifications${unread ? ` (${unread} unread)` : ''}`}
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-white/70 transition hover:bg-white/10 hover:text-white"
    >
      <span className="text-lg leading-none">🔔</span>
      {unread > 0 && (
        <span className="absolute -right-1.5 -top-1.5 min-w-[18px] rounded-full bg-[var(--color-accent)] px-1 text-center text-[10px] font-semibold leading-[18px] text-white">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </Link>
  );
}
