import { createSign } from 'node:crypto';
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { GithubConfig } from './github.config';
import {
  APP_JWT_TTL_SECONDS,
  GITHUB_ACCEPT,
  GITHUB_API_BASE,
  GITHUB_API_VERSION,
  GITHUB_OAUTH_BASE,
  GITHUB_USER_AGENT,
  INSTALLATION_TOKEN_SKEW_MS,
} from './github.constants';

export interface GithubIdentity {
  githubId: number;
  login: string;
  avatarUrl: string | null;
}

interface CachedToken {
  token: string;
  expiresAtMs: number;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Authenticates with the GitHub App using only Node built-ins (crypto + fetch),
 * so there's no ESM/CommonJS friction with the Octokit SDK. Provides:
 *  - appJwt(): a short-lived RS256 JWT signed with the App private key
 *  - getInstallationToken(): a cached installation access token
 *  - exchangeOAuthCode(): user OAuth code → GitHub identity
 */
@Injectable()
export class GithubAuthService {
  private readonly logger = new Logger('GithubAuth');
  private readonly tokenCache = new Map<string, CachedToken>();

  constructor(private readonly config: GithubConfig) {}

  /** Signs a JWT (RS256) proving we are the App. Valid for <10 minutes. */
  appJwt(nowSeconds = Math.floor(Date.now() / 1000)): string {
    if (!this.config.appId || !this.config.privateKey) {
      throw new ServiceUnavailableException('GitHub App is not configured');
    }
    const header = { alg: 'RS256', typ: 'JWT' };
    const payload = {
      // Backdate iat by 60s to tolerate clock skew between us and GitHub.
      iat: nowSeconds - 60,
      exp: nowSeconds + APP_JWT_TTL_SECONDS,
      iss: this.config.appId,
    };
    const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
    const signature = createSign('RSA-SHA256')
      .update(signingInput)
      .sign(this.config.privateKey);
    return `${signingInput}.${base64url(signature)}`;
  }

  /** Returns a cached installation token, minting a fresh one when needed. */
  async getInstallationToken(installationId: string | number): Promise<string> {
    const key = String(installationId);
    const cached = this.tokenCache.get(key);
    if (cached && cached.expiresAtMs - INSTALLATION_TOKEN_SKEW_MS > Date.now()) {
      return cached.token;
    }

    const res = await fetch(
      `${GITHUB_API_BASE}/app/installations/${key}/access_tokens`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.appJwt()}`,
          Accept: GITHUB_ACCEPT,
          'X-GitHub-Api-Version': GITHUB_API_VERSION,
          'User-Agent': GITHUB_USER_AGENT,
        },
      },
    );
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      this.logger.error(`Installation token request failed (${res.status})`);
      throw new ServiceUnavailableException(
        `GitHub installation token request failed: ${res.status} ${body.slice(0, 200)}`,
      );
    }
    const data = (await res.json()) as { token: string; expires_at: string };
    this.tokenCache.set(key, {
      token: data.token,
      expiresAtMs: new Date(data.expires_at).getTime(),
    });
    return data.token;
  }

  /** Exchanges a user OAuth code for the user's GitHub identity. */
  async exchangeOAuthCode(code: string): Promise<GithubIdentity> {
    const tokenRes = await fetch(`${GITHUB_OAUTH_BASE}/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        code,
      }),
    });
    const tokenData = (await tokenRes.json()) as { access_token?: string; error?: string };
    if (!tokenRes.ok || !tokenData.access_token) {
      throw new ServiceUnavailableException(
        `GitHub OAuth exchange failed: ${tokenData.error ?? tokenRes.status}`,
      );
    }

    const userRes = await fetch(`${GITHUB_API_BASE}/user`, {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: GITHUB_ACCEPT,
        'X-GitHub-Api-Version': GITHUB_API_VERSION,
        'User-Agent': GITHUB_USER_AGENT,
      },
    });
    if (!userRes.ok) {
      throw new ServiceUnavailableException(`GitHub user lookup failed: ${userRes.status}`);
    }
    const user = (await userRes.json()) as {
      id: number;
      login: string;
      avatar_url?: string;
    };
    return { githubId: user.id, login: user.login, avatarUrl: user.avatar_url ?? null };
  }

  /** Test/util hook: drop cached tokens (e.g. on uninstall). */
  clearTokenCache(installationId?: string | number): void {
    if (installationId === undefined) this.tokenCache.clear();
    else this.tokenCache.delete(String(installationId));
  }
}
