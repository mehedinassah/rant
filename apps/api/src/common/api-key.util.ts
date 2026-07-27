import { createHash, randomBytes } from 'node:crypto';

/** All rant API keys carry this prefix so we can tell them apart from JWTs. */
export const API_KEY_PREFIX = 'rant_';

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

export function looksLikeApiKey(token: string): boolean {
  return token.startsWith(API_KEY_PREFIX);
}

/** Mints a new key. The raw `key` is returned once and never stored. */
export function generateApiKey(): { key: string; prefix: string; hash: string } {
  const token = randomBytes(24).toString('base64url');
  const key = `${API_KEY_PREFIX}${token}`;
  return { key, prefix: key.slice(0, 12), hash: hashApiKey(key) };
}
