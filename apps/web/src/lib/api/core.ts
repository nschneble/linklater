export {
  clearStoredToken,
  getStoredRefreshToken,
  getStoredToken,
  setStoredToken,
} from './storage';

import {
  API_BASE_URL,
  clearStoredToken,
  getStoredRefreshToken,
  getStoredToken,
  setStoredToken,
} from './storage';

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function parseResponse<T>(response: Response): Promise<T | undefined> {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError(
      `Server returned non-JSON response: ${text.slice(0, 100)}`,
      0,
    );
  }
}

async function parseError(response: Response): Promise<ApiError> {
  const text = await response.text();
  let message = text || `Request failed with ${response.status}`;
  try {
    const body = JSON.parse(text) as { message?: string };
    if (body.message) message = body.message;
  } catch {
    // Body is not JSON – use the raw text as the error message.
  }
  return new ApiError(message, response.status);
}

let inFlightRefresh: Promise<boolean> | null = null;

/**
 * Deadline for the token-refresh fetch. apiFetch imposes no timeout of its own,
 * and every 401'd caller awaits this single shared refresh, so a refresh hung
 * on a dead network (a mid-request socket stall) would hold every awaiter open
 * until the browser's socket-level timeout, which can run to minutes. Callers
 * that carry their own per-request deadline still could not escape it: the
 * metadata poller's deadline bounds its poll but explicitly does not cover the
 * refresh leg it triggers. Bounding the refresh here is the only place that
 * leg gets a limit.
 *
 * An abort rejects the fetch exactly as an unreachable server would, so a
 * timed-out refresh follows the same catch below as any network failure: this
 * request fails, but the stored tokens survive because a refresh that never
 * answered has not proven the session dead. Held at 10s to match the poller's
 * per-request deadline: comfortably above a healthy round-trip on a slow
 * connection, well under the socket timeout it stands in for.
 * AbortSignal.timeout is deliberately avoided; its internal timer is not
 * driven by the test suite's fake timers.
 */
const REFRESH_DEADLINE_MS = 10_000;

async function performTokenRefresh(): Promise<boolean> {
  if (!getStoredRefreshToken()) return false;

  // The refresh owns this deadline. It is never wired to a caller's signal: one
  // caller aborting its own request must not tear down the shared refresh that
  // every other 401'd caller is awaiting.
  const deadlineController = new AbortController();
  const deadlineTimeoutId = setTimeout(
    () => deadlineController.abort(),
    REFRESH_DEADLINE_MS,
  );

  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: getStoredRefreshToken() }),
      signal: deadlineController.signal,
    });

    if (!response.ok) {
      // Only a server-answered auth rejection proves the refresh token is
      // spent. A 401 or 403 ends the session; every other status (a 5xx
      // server fault, most often) is transient, so the tokens stay put for a
      // later request to retry. Keeping them adds no exposure since they were
      // already stored: only the server's own rejection settles that the
      // session is dead.
      if (response.status === 401 || response.status === 403) {
        clearStoredToken();
      }
      return false;
    }

    const data = (await response.json()) as {
      accessToken: string;
      refreshToken: string;
    };
    setStoredToken(data.accessToken, data.refreshToken);
    return true;
  } catch {
    // A network failure or a deadline abort means the refresh never reached a
    // verdict, so the session is not proven dead. Leave the stored tokens in
    // place: the triggering request still fails, but a later one can retry.
    // Keeping them adds no exposure since they were already stored.
    return false;
  } finally {
    clearTimeout(deadlineTimeoutId);
  }
}

// Dedup concurrent refreshes so N parallel 401s share one /auth/refresh call.
async function attemptTokenRefresh(): Promise<boolean> {
  if (inFlightRefresh) return inFlightRefresh;
  inFlightRefresh = performTokenRefresh().finally(() => {
    inFlightRefresh = null;
  });
  return inFlightRefresh;
}

// Two overloads: callers that do not need a typed response (e.g. POST/DELETE
// endpoints that only signal success) call without `<T>` and get
// `Promise<void>`. Callers that read a JSON body pass `<T>` and get
// `Promise<T>`. Without the void overload, untyped callers silently get
// `Promise<unknown>` and the JSON body leaks into a typed return position.
//
// Note: if the server returns an empty body for a typed endpoint, the resolved
// value will be `undefined` at runtime even though the type says `T`. Callers
// that depend on the body being present should guard against undefined (see
// login(), verifyMagicLink(), verifyOtp() in auth.ts for the pattern).

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
      const refreshed = await attemptTokenRefresh();
      if (refreshed) {
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
