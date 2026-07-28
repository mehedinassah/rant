import { API_KEY_PREFIX, generateApiKey, hashApiKey, looksLikeApiKey } from './api-key.util';

describe('api-key util', () => {
  it('generates a prefixed key with a matching hash', () => {
    const { key, prefix, hash } = generateApiKey();
    expect(key.startsWith(API_KEY_PREFIX)).toBe(true);
    expect(prefix).toBe(key.slice(0, 12));
    expect(hash).toBe(hashApiKey(key));
    expect(hash).toHaveLength(64); // sha256 hex
  });

  it('produces a unique key each call', () => {
    const a = generateApiKey();
    const b = generateApiKey();
    expect(a.key).not.toBe(b.key);
    expect(a.hash).not.toBe(b.hash);
  });

  it('hashes deterministically', () => {
    expect(hashApiKey('rant_abc')).toBe(hashApiKey('rant_abc'));
    expect(hashApiKey('rant_abc')).not.toBe(hashApiKey('rant_abd'));
  });

  it('recognises rant keys and rejects others', () => {
    expect(looksLikeApiKey('rant_something')).toBe(true);
    expect(looksLikeApiKey('eyJhbGciOi.jwt.token')).toBe(false);
    expect(looksLikeApiKey('')).toBe(false);
  });
});
