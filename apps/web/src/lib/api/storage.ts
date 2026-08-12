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
    // storage quota exceeded or blocked; keep the in-memory copy
  }
}

/** Safely removes from `localStorage`. No-op when storage is unavailable. */
function safeRemove(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // nothing to do; caller keeps the in-memory copy in sync
  }
}

let cachedToken: string | null = safeRead(TOKEN_KEY);
let cachedRefreshToken: string | null = safeRead(REFRESH_TOKEN_KEY);

/**
 * Reads the persisted copy, falling back to the in-memory one. A `null`
 * read means absent, unreadable, or removed by another tab – never proof
 * the session ended, so the token this tab holds survives it. Reading
 * through is what lets a rotation performed in one tab reach the others:
 * the in-memory copy alone would go stale the moment a sibling tab renewed
 * the pair, and the stale refresh token is already spent server-side.
 */
function readPersisted(key: string, cached: string | null): string | null {
  const persisted = safeRead(key);
  if (persisted === null) return cached;
  return persisted;
}

export function getStoredToken(): string | null {
  return readPersisted(TOKEN_KEY, cachedToken);
}

export function getStoredRefreshToken(): string | null {
  return readPersisted(REFRESH_TOKEN_KEY, cachedRefreshToken);
}

export function setStoredToken(
  accessToken: string,
  refreshToken?: string,
): void {
  cachedToken = accessToken;
  safeWrite(TOKEN_KEY, accessToken);

  if (refreshToken !== undefined) {
    cachedRefreshToken = refreshToken;
    safeWrite(REFRESH_TOKEN_KEY, refreshToken);
  }
}

export function clearStoredToken(): void {
  cachedToken = null;
  cachedRefreshToken = null;
  safeRemove(TOKEN_KEY);
  safeRemove(REFRESH_TOKEN_KEY);
}

/**
 * Pulls a sibling tab's rotation into the in-memory copy as it happens, so
 * a read taken after storage becomes unreadable still answers with the
 * rotated pair rather than the one read at boot. The `storage` event never
 * fires in the tab that wrote, so this only ever carries another tab's
 * work. The store is re-read rather than trusting the event payload: one
 * source of truth, and the rule that a `null` never evicts a live token
 * then lives in a single place.
 */
function handleTokenStorageEvent(event: StorageEvent): void {
  if (event.key !== TOKEN_KEY && event.key !== REFRESH_TOKEN_KEY) return;
  cachedToken = readPersisted(TOKEN_KEY, cachedToken);
  cachedRefreshToken = readPersisted(REFRESH_TOKEN_KEY, cachedRefreshToken);
}

let crossTabSyncStarted = false;

function startCrossTabTokenSync(): void {
  if (typeof window === 'undefined' || crossTabSyncStarted) return;
  window.addEventListener('storage', handleTokenStorageEvent);
  crossTabSyncStarted = true;
}

startCrossTabTokenSync();

/**
 * Detaches the cross-tab listener. The app never stops syncing while it
 * runs; this exists so a suite that re-imports the module does not leave a
 * listener behind on the shared `window`.
 */
export function stopCrossTabTokenSync(): void {
  if (typeof window === 'undefined') return;
  window.removeEventListener('storage', handleTokenStorageEvent);
  crossTabSyncStarted = false;
}
