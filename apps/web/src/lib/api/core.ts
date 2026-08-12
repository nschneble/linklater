export {
  clearStoredToken,
  getStoredRefreshToken,
  getStoredToken,
  isTokenStorageEvent,
  setStoredToken,
} from './storage';

import { API_BASE_URL, getStoredToken } from './storage';
import { ApiError, parseError, parseResponse } from './responses';
import { attemptSpeculativeRefresh, attemptTokenRefresh } from './tokenRefresh';
import { readTokenClaims } from './jwt';

/**
 * Controls the Authorization header on an `apiFetch` call:
 * - `true` (default) – attach the stored JWT, renewing it first if it has
 *   already run out; retry once after a 401 with a token refresh
 * - `false` – send no Authorization header (public/unauthenticated endpoints)
 * - `string` – use the provided literal token as-is (e.g. a PAT or MFA token)
 */
export type AuthContext = boolean | string;

/**
 * Whether this token is known to have run out, which is the one case where
 * sending it is a round trip whose answer is already decided. Access tokens
 * are signed for an hour, so a tab returning from an idle afternoon holds
 * one of these, and spending a leg to be told so is the whole cost this
 * question removes.
 *
 * Only a readable expiry sitting in the past answers yes. An expiry that
 * is absent, mistyped or unreadable answers no, as does an opaque `ltk_`
 * API token with no payload to read, because none of those is evidence of
 * anything and the server is the authority either way.
 *
 * The clock is the browser's and the expiry is the server's, so the two
 * can disagree. A slow clock asks for no renewal and falls back to being
 * told by the server. A fast one asks early and can be refused, but a
 * refusal ahead of the request clears nothing, so the token in question
 * still goes out and the server keeps the last word on it. Neither
 * answer can lose a live session, which is why no skew allowance is
 * taken.
 */
function hasTokenExpired(token: string): boolean {
  const expiry = readTokenClaims(token)?.exp;
  return typeof expiry === 'number' && expiry * 1000 < Date.now();
}

/**
 * Like `apiFetch<T>` but throws `ApiError` when the server returns an empty
 * body. Use this on endpoints that must return JSON – avoids repeating the
 * `if (data === undefined) throw new ApiError(...)` guard at every callsite.
 */
export async function apiFetchRequired<T>(
  path: string,
  options?: RequestInit,
  authContext?: AuthContext,
): Promise<T> {
  const data = await apiFetch<T>(path, options, authContext);
  if (data === undefined) {
    throw new ApiError(`${path} returned an empty response`, 0);
  }
  return data;
}

// untyped callers get void, typed get T; an empty typed body is
// `undefined` at runtime
export async function apiFetch(
  path: string,
  options?: RequestInit,
  authContext?: AuthContext,
): Promise<void>;
export async function apiFetch<T>(
  path: string,
  options?: RequestInit,
  authContext?: AuthContext,
): Promise<T>;
export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  authContext: AuthContext = true,
): Promise<T | undefined | void> {
  let token: string | null = null;
  if (typeof authContext === 'string') {
    token = authContext;
  } else if (authContext) {
    token = getStoredToken();
  }

  if (authContext === true && token && hasTokenExpired(token)) {
    // a refusal here clears nothing; only a refused request ends it
    await attemptSpeculativeRefresh();
    token = getStoredToken();
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    if (
      response.status === 401 &&
      authContext === true &&
      path !== '/auth/refresh'
    ) {
      // true also when another tab's rotation left a newer token to use
      const canRetry = await attemptTokenRefresh();
      if (canRetry) {
        const retryHeaders = {
          ...headers,
          Authorization: `Bearer ${getStoredToken()}`,
        };
        const retryResponse = await fetch(`${API_BASE_URL}${path}`, {
          ...options,
          headers: retryHeaders,
        });
        if (retryResponse.ok) {
          return parseResponse<T>(retryResponse);
        }
        throw await parseError(retryResponse);
      }
    }

    throw await parseError(response);
  }

  return parseResponse<T>(response);
}
