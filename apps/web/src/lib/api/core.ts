export {
  clearStoredToken,
  getStoredRefreshToken,
  getStoredToken,
  isTokenStorageEvent,
  setStoredToken,
} from './storage';

import { API_BASE_URL, getStoredToken } from './storage';
import { ApiError, parseError, parseResponse } from './responses';
import { attemptTokenRefresh } from './tokenRefresh';

/**
 * Controls the Authorization header on an `apiFetch` call:
 * - `true` (default) – attach the stored JWT; retry once after a 401 with a
 *   token refresh
 * - `false` – send no Authorization header (public/unauthenticated endpoints)
 * - `string` – use the provided literal token as-is (e.g. a PAT or MFA token)
 */
export type AuthContext = boolean | string;

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
