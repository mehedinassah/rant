import Link from 'next/link';

const MODULES = [
  ['Organizations', 'Teams, RBAC, API keys, audit logs, usage.'],
  ['Workspaces', 'Dashboards, wikis, roadmaps, goals.'],
  ['Projects', 'Sprints, epics, tasks, burndown — Linear-style.'],
  ['Repositories', 'Branches, PRs, reviews, merge queue.'],
  ['CI/CD', 'Pipelines: build, test, scan, deploy, notify.'],
  ['Deployments', 'Environments, domains, SSL, rollback.'],
  ['Monitoring', 'CPU, latency, errors, live console.'],
  ['AI Copilot', 'Context-aware: summarize, review, explain.'],
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col px-6">
      <header className="flex items-center justify-between py-6">
        <span className="text-lg font-semibold tracking-tight">
          rant<span className="text-[var(--color-accent)]">.</span>
        </span>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/login" className="text-white/70 hover:text-white">
            Sign in
          </Link>
          <Link
            href="/register"
            className="rounded-lg bg-[var(--color-accent)] px-4 py-2 font-medium text-white hover:opacity-90"
          >
            Get started
          </Link>
        </nav>
      </header>

      <section className="flex flex-1 flex-col justify-center py-20">
        <p className="mb-4 inline-flex w-fit rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/60">
          The operating system for modern software teams
        </p>
        <h1 className="max-w-3xl text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
          Plan, build, ship, and monitor —{' '}
          <span className="bg-gradient-to-r from-[var(--color-accent-soft)] to-[var(--color-accent)] bg-clip-text text-transparent">
            all in one place.
          </span>
        </h1>
        <p className="mt-6 max-w-xl text-lg text-white/60">
          Not a GitHub clone. Not a Jira clone. A complete software engineering
          ecosystem where every action ripples through the whole system.
        </p>
        <div className="mt-8 flex gap-3">
          <Link
            href="/register"
            className="rounded-lg bg-[var(--color-accent)] px-6 py-3 font-medium text-white hover:opacity-90"
          >
            Start building
          </Link>
          <Link
            href="/login"
            className="rounded-lg border border-white/15 px-6 py-3 font-medium text-white/80 hover:bg-white/5"
          >
            Sign in
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 pb-24 sm:grid-cols-2 lg:grid-cols-4">
        {MODULES.map(([title, desc]) => (
          <div
            key={title}
            className="rounded-xl border border-white/10 bg-[var(--color-ink-soft)] p-5"
          >
            <h3 className="font-medium">{title}</h3>
            <p className="mt-1 text-sm text-white/50">{desc}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
