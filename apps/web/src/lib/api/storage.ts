const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string;

if (!API_BASE_URL) {
  console.warn('VITE_API_BASE_URL is not set');
}

export { API_BASE_URL };

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

/**
 * Resets the module-level token singletons to `null` without touching
 * `localStorage`. Use in test `beforeEach` to prevent stale state from
 * one test leaking into the next — each test that calls `setStoredToken`
 * gets a clean slate.
 *
 * Not exported from the public API barrel (`lib/api/index.ts`) — this is
 * a test-only helper.
 */
export function resetStorageForTesting(): void {
  storedToken = null;
  storedRefreshToken = null;
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
