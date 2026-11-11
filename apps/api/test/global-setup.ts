import { execSync } from 'node:child_process';
import { join } from 'node:path';

/**
 * Applies the committed Prisma migrations to the disposable e2e database before
 * any spec boots the app. Point DATABASE_URL at a database you can truncate.
 */
export default function globalSetup(): void {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL is required for e2e tests (point it at a disposable Postgres database).',
    );
  }
  // Refuse the obvious footguns: tests truncate everything.
  if (/prod/i.test(url)) {
    throw new Error('Refusing to run e2e tests against a DATABASE_URL containing "prod".');
  }

  const repoRoot = join(__dirname, '../../..');
  execSync('pnpm db:migrate:deploy', {
    cwd: repoRoot,
    env: process.env,
    stdio: 'inherit',
  });
}
