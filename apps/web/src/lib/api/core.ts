const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string;

if (!API_BASE_URL) {
  console.warn('VITE_API_BASE_URL is not set');
}

const TOKEN_KEY = 'linklater_token';
const REFRESH_TOKEN_KEY = 'linklater_refresh_token';

/**
 * Safely reads from `localStorage`. Returns `null` in SSR environments or
 * when the read fails (e.g. Safari private browsing throws on access).
 */
function safeRead(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Safely writes to `localStorage`. No-op when storage is unavailable. */
function safeWrite(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage quota exceeded or blocked — keep the in-memory copy so the
    // current session keeps working, but skip persistence.
  }
}

/** Safely removes from `localStorage`. No-op when storage is unavailable. */
function safeRemove(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Nothing to do — keep the in-memory copy in sync via the caller.
  }
}

let storedToken: string | null = safeRead(TOKEN_KEY);
let storedRefreshToken: string | null = safeRead(REFRESH_TOKEN_KEY);

export function getStoredToken(): string | null {
  return storedToken;
}

export function getStoredRefreshToken(): string | null {
  return storedRefreshToken;
}

export function setStoredToken(
  accessToken: string,
  refreshToken?: string,
): void {
  storedToken = accessToken;
  safeWrite(TOKEN_KEY, accessToken);

  if (refreshToken !== undefined) {
    storedRefreshToken = refreshToken;
    safeWrite(REFRESH_TOKEN_KEY, refreshToken);
  }
}

export function clearStoredToken(): void {
  storedToken = null;
  storedRefreshToken = null;
  safeRemove(TOKEN_KEY);
  safeRemove(REFRESH_TOKEN_KEY);
}

export type LoginResponse =
  | { accessToken: string; refreshToken: string }
  | { mfaToken: string; mfaMethod: 'totp' };

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
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
  if (!storedRefreshToken) return false;

  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: storedRefreshToken }),
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

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  includeAuth: boolean | string = true,
): Promise<T> {
  let token: string | null = null;
  if (typeof includeAuth === 'string') {
    token = includeAuth;
  } else if (includeAuth) {
    token = storedToken;
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
      includeAuth === true &&
      path !== '/auth/refresh'
    ) {
      const refreshed = await attemptTokenRefresh();
      if (refreshed) {
        const retryHeaders = {
          ...headers,
          Authorization: `Bearer ${storedToken}`,
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
