import { createVerify, generateKeyPairSync } from 'node:crypto';
import { GithubAuthService } from './github-auth.service';
import { GithubConfig } from './github.config';

// A throwaway RSA keypair so we can sign + verify real JWTs in-process.
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const privatePem = privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();
const publicPem = publicKey.export({ type: 'pkcs1', format: 'pem' }).toString();

function fakeConfig(overrides: Partial<Record<string, string>> = {}): GithubConfig {
  const values: Record<string, string> = {
    GITHUB_APP_ID: '123456',
    GITHUB_APP_PRIVATE_KEY: Buffer.from(privatePem).toString('base64'),
    GITHUB_APP_CLIENT_ID: 'client-id',
    GITHUB_APP_CLIENT_SECRET: 'client-secret',
    GITHUB_WEBHOOK_SECRET: 'whsec',
    ...overrides,
  };
  return new GithubConfig({ get: (k: string, d?: string) => values[k] ?? d ?? '' } as never);
}

function decodeJwt(jwt: string) {
  const [h, p, s] = jwt.split('.');
  const b64 = (x: string) => Buffer.from(x.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  return {
    header: JSON.parse(b64(h).toString()),
    payload: JSON.parse(b64(p).toString()),
    signature: b64(s),
    signingInput: `${h}.${p}`,
  };
}

describe('GithubAuthService', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
    jest.restoreAllMocks();
  });

  describe('appJwt', () => {
    it('produces a verifiable RS256 JWT with the right claims', () => {
      const svc = new GithubAuthService(fakeConfig());
      const now = 1_700_000_000;
      const jwt = svc.appJwt(now);
      const { header, payload, signature, signingInput } = decodeJwt(jwt);

      expect(header).toEqual({ alg: 'RS256', typ: 'JWT' });
      expect(payload.iss).toBe('123456');
      expect(payload.iat).toBe(now - 60); // clock-skew backdate
      expect(payload.exp).toBeGreaterThan(now);
      expect(payload.exp - payload.iat).toBeLessThanOrEqual(600); // <=10min

      const verified = createVerify('RSA-SHA256').update(signingInput).verify(publicPem, signature);
      expect(verified).toBe(true);
    });

    it('throws when the App is not configured', () => {
      const svc = new GithubAuthService(fakeConfig({ GITHUB_APP_ID: '', GITHUB_APP_PRIVATE_KEY: '' }));
      expect(() => svc.appJwt()).toThrow();
    });
  });

  describe('getInstallationToken', () => {
    it('mints a token and caches it (one network call for repeated reads)', async () => {
      const svc = new GithubAuthService(fakeConfig());
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ token: 'ghs_abc', expires_at: new Date(Date.now() + 3600_000).toISOString() }),
      });
      global.fetch = fetchMock as never;

      const t1 = await svc.getInstallationToken(42);
      const t2 = await svc.getInstallationToken(42);
      expect(t1).toBe('ghs_abc');
      expect(t2).toBe('ghs_abc');
      expect(fetchMock).toHaveBeenCalledTimes(1); // cached second time
    });

    it('re-mints after the cache is cleared', async () => {
      const svc = new GithubAuthService(fakeConfig());
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ token: 'ghs_x', expires_at: new Date(Date.now() + 3600_000).toISOString() }),
      });
      global.fetch = fetchMock as never;

      await svc.getInstallationToken(7);
      svc.clearTokenCache(7);
      await svc.getInstallationToken(7);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('throws on a non-OK response', async () => {
      const svc = new GithubAuthService(fakeConfig());
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404, text: async () => 'nope' }) as never;
      await expect(svc.getInstallationToken(9)).rejects.toThrow();
    });
  });

  describe('exchangeOAuthCode', () => {
    it('maps a code to a GitHub identity', async () => {
      const svc = new GithubAuthService(fakeConfig());
      const fetchMock = jest
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'gho_1' }) })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 555, login: 'octocat', avatar_url: 'http://img/x.png' }),
        });
      global.fetch = fetchMock as never;

      const identity = await svc.exchangeOAuthCode('the-code');
      expect(identity).toEqual({ githubId: 555, login: 'octocat', avatarUrl: 'http://img/x.png' });
    });

    it('throws when GitHub returns no access token', async () => {
      const svc = new GithubAuthService(fakeConfig());
      global.fetch = jest.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'bad_verification_code' }) }) as never;
      await expect(svc.exchangeOAuthCode('x')).rejects.toThrow();
    });
  });
});
