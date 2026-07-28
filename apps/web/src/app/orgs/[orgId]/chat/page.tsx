'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  chat as chatApi,
  streamChannel,
  initials,
  type Channel,
  type ChatMessage,
} from '@/lib/api';
import { useRequireAuth } from '@/lib/use-require-auth';

function timeShort(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ChatPage() {
  const ready = useRequireAuth();
  const { orgId } = useParams<{ orgId: string }>();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const threadRef = useRef<HTMLDivElement>(null);
  const stopRef = useRef<(() => void) | undefined>(undefined);

  const loadChannels = useCallback(async () => {
    try {
      const list = await chatApi.channels(orgId);
      setChannels(list);
      setActiveId((cur) => cur ?? list[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    }
  }, [orgId]);

  useEffect(() => {
    if (ready) void loadChannels();
  }, [ready, loadChannels]);

  // Live stream for the active channel.
  useEffect(() => {
    if (!ready || !activeId) return;
    setMessages([]);
    stopRef.current?.();
    stopRef.current = streamChannel(orgId, activeId, setMessages);
    return () => stopRef.current?.();
  }, [ready, orgId, activeId]);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight });
  }, [messages]);

  async function send() {
    const body = input.trim();
    if (!body || !activeId) return;
    setInput('');
    try {
      const msg = await chatApi.post(orgId, activeId, body);
      setMessages((prev) => [...prev, msg]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send');
    }
  }

  async function createChannel(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '');
    if (!name) return;
    try {
      const c = await chatApi.createChannel(orgId, { name });
      setNewName('');
      setCreating(false);
      await loadChannels();
      setActiveId(c.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create channel');
    }
  }

  if (!ready) return null;
  const active = channels.find((c) => c.id === activeId);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <Link href={`/orgs/${orgId}`} className="text-sm text-white/50 hover:text-white">
        ← Organization
      </Link>
      <h1 className="mt-3 text-2xl font-semibold">Team Chat</h1>
      <p className="text-sm text-white/40">Channels for your team — plus an activity feed fed by the platform itself.</p>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      <div className="mt-6 grid gap-4 md:grid-cols-[200px_1fr]">
        {/* Channels */}
        <aside className="rounded-xl border border-white/10 bg-[var(--color-ink-soft)] p-3">
          <ul className="space-y-0.5">
            {channels.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => setActiveId(c.id)}
                  className={`flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-sm ${
                    activeId === c.id ? 'bg-white/10' : 'hover:bg-white/5'
                  }`}
                >
                  <span className="text-white/40">{c.isSystem ? '⚡' : '#'}</span>
                  <span className="truncate">{c.name}</span>
                </button>
              </li>
            ))}
          </ul>
          {creating ? (
            <form onSubmit={createChannel} className="mt-2">
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="channel-name"
                className="w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm outline-none focus:border-[var(--color-accent)]"
              />
            </form>
          ) : (
            <button
              onClick={() => setCreating(true)}
              className="mt-2 w-full rounded-lg px-2 py-1.5 text-left text-sm text-white/40 hover:bg-white/5"
            >
              + Add channel
            </button>
          )}
        </aside>

        {/* Thread */}
        <section className="flex min-h-[28rem] flex-col rounded-xl border border-white/10 bg-[var(--color-ink-soft)]">
          <div className="border-b border-white/10 px-4 py-2.5">
            <span className="font-medium">
              {active?.isSystem ? '⚡ ' : '#'}
              {active?.name ?? '…'}
            </span>
            {active?.topic && <span className="ml-2 text-xs text-white/40">{active.topic}</span>}
          </div>

          <div ref={threadRef} className="flex-1 space-y-3 overflow-auto p-4">
            {messages.length === 0 ? (
              <p className="text-sm text-white/30">No messages yet.</p>
            ) : (
              messages.map((m) =>
                m.kind === 'SYSTEM' ? (
                  <div key={m.id} className="flex justify-center">
                    <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-white/50">
                      {m.body} · {timeShort(m.createdAt)}
                    </span>
                  </div>
                ) : (
                  <div key={m.id} className="flex gap-2.5">
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)]/30 text-[11px] font-medium">
                      {m.author ? initials(m.author.name) : '?'}
                    </div>
                    <div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-medium">{m.author?.name ?? 'Unknown'}</span>
                        <span className="text-[11px] text-white/30">{timeShort(m.createdAt)}</span>
                      </div>
                      <p className="whitespace-pre-wrap text-sm text-white/80">{m.body}</p>
                    </div>
                  </div>
                ),
              )
            )}
          </div>

          {!active?.isSystem && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void send();
              }}
              className="flex gap-2 border-t border-white/10 p-3"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={`Message #${active?.name ?? ''}`}
                className="flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
              />
              <button
                disabled={!input.trim()}
                className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                Send
              </button>
            </form>
          )}
          {active?.isSystem && (
            <div className="border-t border-white/10 px-4 py-2.5 text-xs text-white/30">
              This channel is fed automatically by deploys, incidents, CI and pull requests.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
