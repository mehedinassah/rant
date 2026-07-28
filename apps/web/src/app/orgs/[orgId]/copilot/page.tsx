'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  copilot as copilotApi,
  type CopilotConversation,
  type CopilotMessage,
} from '@/lib/api';
import { useRequireAuth } from '@/lib/use-require-auth';

export default function CopilotPage() {
  const ready = useRequireAuth();
  const { orgId } = useParams<{ orgId: string }>();
  const [conversations, setConversations] = useState<CopilotConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async () => {
    setConversations(await copilotApi.conversations(orgId).catch(() => []));
  }, [orgId]);

  useEffect(() => {
    if (!ready) return;
    void loadConversations();
    copilotApi.suggestions(orgId).then(setSuggestions).catch(() => undefined);
  }, [ready, orgId, loadConversations]);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  async function openConversation(id: string) {
    setActiveId(id);
    setError(null);
    try {
      const c = await copilotApi.conversation(orgId, id);
      setMessages(c.messages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open');
    }
  }

  function newChat() {
    setActiveId(null);
    setMessages([]);
  }

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    setBusy(true);
    setError(null);
    setInput('');
    // Optimistically show the user's message.
    const optimistic: CopilotMessage = {
      id: `tmp-${Date.now()}`,
      role: 'USER',
      content: message,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    try {
      const res = await copilotApi.ask(orgId, message, activeId ?? undefined);
      setActiveId(res.conversationId);
      setMessages((prev) => [...prev, res.message]);
      await loadConversations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    await copilotApi.remove(orgId, id).catch(() => undefined);
    if (activeId === id) newChat();
    await loadConversations();
  }

  if (!ready) return null;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <Link href={`/orgs/${orgId}`} className="text-sm text-white/50 hover:text-white">
        ← Organization
      </Link>
      <h1 className="mt-3 flex items-center gap-2 text-2xl font-semibold">✨ Copilot</h1>
      <p className="text-sm text-white/40">
        Grounded in your org’s live data — answers cite the exact records they came from.
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-[220px_1fr]">
        {/* Conversation list */}
        <aside className="rounded-xl border border-white/10 bg-[var(--color-ink-soft)] p-3">
          <button
            onClick={newChat}
            className="mb-2 w-full rounded-lg bg-white/10 px-3 py-1.5 text-sm font-medium hover:bg-white/20"
          >
            + New chat
          </button>
          {conversations.length === 0 ? (
            <p className="px-2 py-3 text-xs text-white/30">No conversations yet.</p>
          ) : (
            <ul className="space-y-0.5">
              {conversations.map((c) => (
                <li
                  key={c.id}
                  className={`group flex items-center justify-between rounded-lg px-2 py-1.5 text-sm ${
                    activeId === c.id ? 'bg-white/10' : 'hover:bg-white/5'
                  }`}
                >
                  <button onClick={() => openConversation(c.id)} className="flex-1 truncate text-left">
                    {c.title}
                  </button>
                  <button
                    onClick={() => remove(c.id)}
                    className="ml-1 text-white/30 opacity-0 hover:text-red-400 group-hover:opacity-100"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        {/* Thread */}
        <section className="flex min-h-[28rem] flex-col rounded-xl border border-white/10 bg-[var(--color-ink-soft)]">
          <div ref={threadRef} className="flex-1 space-y-4 overflow-auto p-4">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                <p className="text-white/40">Ask me about your organisation.</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="rounded-full border border-white/15 px-3 py-1.5 text-sm text-white/60 hover:bg-white/5 hover:text-white"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m) => (
                <div key={m.id} className={`flex ${m.role === 'USER' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                      m.role === 'USER'
                        ? 'bg-[var(--color-accent)] text-white'
                        : 'border border-white/10 bg-black/30'
                    }`}
                  >
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{m.content}</p>
                    {m.citations && m.citations.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5 border-t border-white/10 pt-2">
                        {m.citations.map((c, i) => (
                          <Link
                            key={i}
                            href={c.linkPath}
                            className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-[var(--color-accent-soft)] hover:bg-white/20"
                          >
                            ↗ {c.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
            {busy && <p className="text-sm text-white/40">Thinking…</p>}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
            className="flex gap-2 border-t border-white/10 p-3"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about incidents, deploys, your work…"
              className="flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
            />
            <button
              disabled={busy || !input.trim()}
              className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              Send
            </button>
          </form>
        </section>
      </div>
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
    </main>
  );
}
