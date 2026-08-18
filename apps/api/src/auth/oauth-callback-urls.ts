import { requireEnv } from '../common/index.js';

/**
 * Single source of truth for every OAuth provider callback URL.
 *
 * A callback URL has to byte-match the redirect URI registered with the
 * provider, and it used to be spelled out three times over: once in the
 * provider console, once in a per-flow environment variable, and once in
 * the route decorator that answers it. Deriving it here from one public
 * origin plus the route the controller mounts leaves the console as the
 * only copy left to keep in step.
 *
 * `API_URL` is the origin browsers reach the API on, including any path a
 * reverse proxy mounts it under (`https://example.com/api`), which is why
 * it is not assembled from a host and a port.
 */

/** Route prefix every auth controller shares. */
export const AUTH_ROUTE_PREFIX = 'auth';

export const APPLE_SIGN_IN_CALLBACK_ROUTE = 'apple/callback';
export const GOOGLE_LINK_CALLBACK_ROUTE = 'google/link/callback';
export const GOOGLE_SIGN_IN_CALLBACK_ROUTE = 'google/callback';

/**
 * Builds the absolute callback URL for a route mounted under the auth
 * prefix.
 *
 * @throws {Error} When `API_URL` is unset or empty.
 */
export function publicCallbackUrl(route: string): string {
  const baseUrl = requireEnv('API_URL').replace(/\/+$/, '');
  return `${baseUrl}/${AUTH_ROUTE_PREFIX}/${route}`;
}
