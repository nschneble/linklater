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
    // Body is not JSON — use the raw text as the error message.
  }
  return new ApiError(message, response.status);
}

let inFlightRefresh: Promise<boolean> | null = null;

async function performTokenRefresh(): Promise<boolean> {
  if (!getStoredRefreshToken()) return false;

  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: getStoredRefreshToken() }),
    });

    if (!response.ok) {
      clearStoredToken();
      return false;
    }

    const data = (await response.json()) as {
      accessToken: string;
      refreshToken: string;
    };
    setStoredToken(data.accessToken, data.refreshToken);
    return true;
  } catch {
    clearStoredToken();
    return false;
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
 * - `true` (default) — attach the stored JWT; retry once after a 401 with a
 *   token refresh
 * - `false` — send no Authorization header (public/unauthenticated endpoints)
 * - `string` — use the provided literal token as-is (e.g. a PAT or MFA token)
 */
export type AuthContext = boolean | string;

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
