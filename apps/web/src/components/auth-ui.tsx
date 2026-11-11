'use client';

import Link from 'next/link';

const TICKER = [
  'PLAN',
  'BUILD',
  'SHIP',
  'OBSERVE',
  'REPEAT',
  'ONE SYSTEM',
  'ZERO HANDOFFS',
  'EVERY ACTION RIPPLES',
];

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <main className="relative flex min-h-screen flex-col">
      <div className="overflow-hidden border-b-2 border-black bg-[var(--color-accent)] text-black">
        <div className="brutal-marquee">
          {[0, 1].map((group) => (
            <div key={group} className="flex shrink-0 gap-12 pr-12">
              {TICKER.map((word) => (
                <span key={`${group}-${word}`} className="flex items-center gap-12">
                  {word}
                  <span aria-hidden>✶</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <div className="mb-5 flex items-end justify-between gap-4">
            <Link href="/" className="brutal-logo">
              rant<span>.</span>
            </Link>
            <span className="brutal-stamp">SYSTEM // ONLINE</span>
          </div>

          <div className="brutal-panel p-6 sm:p-8">
            <p className="brutal-kicker">Access terminal</p>
            <h1 className="mt-2 text-3xl sm:text-4xl">{title}</h1>
            <p className="mb-6 mt-2 font-mono text-xs leading-relaxed text-white/50">{subtitle}</p>
            {children}
          </div>

          <div className="mt-4 flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-white/35">
            <span>build 0.1 // localhost</span>
            <span>no handoffs</span>
          </div>
        </div>
      </div>
    </main>
  );
}

export function Field({
  label,
  type,
  value,
  onChange,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">
        <span aria-hidden className="inline-block h-2 w-2 bg-[var(--color-accent)]" />
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        className="w-full px-3 py-2.5 text-sm"
      />
    </label>
  );
}
