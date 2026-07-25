import { randomBytes } from 'node:crypto';

/** Generates a git-style 40-char hex SHA. These are synthetic (metadata layer),
 *  not derived from real object content — good enough to model history. */
export function generateSha(): string {
  return randomBytes(20).toString('hex');
}

export function shortSha(sha: string): string {
  return sha.slice(0, 7);
}
