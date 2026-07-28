/** GitHub REST + OAuth endpoints and integration-wide constants. */
export const GITHUB_API_BASE = 'https://api.github.com';
export const GITHUB_OAUTH_BASE = 'https://github.com/login/oauth';
export const GITHUB_ACCEPT = 'application/vnd.github+json';
export const GITHUB_API_VERSION = '2022-11-28';
export const GITHUB_USER_AGENT = 'rant-integration';

/** BullMQ queue that processes inbound webhook deliveries (see G3/G4). */
export const GITHUB_EVENTS_QUEUE = 'github-events';

/** BullMQ queue that runs installation backfill sync off the request path (G5). */
export const GITHUB_SYNC_QUEUE = 'github-sync';

/** App JWTs must live <=10min; we use 9 to allow for clock skew. */
export const APP_JWT_TTL_SECONDS = 9 * 60;
/** Refresh an installation token this many ms before it actually expires. */
export const INSTALLATION_TOKEN_SKEW_MS = 60_000;
