const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string;

if (!API_BASE_URL) {
  console.warn('VITE_API_BASE_URL is not set');
}

export { API_BASE_URL };

const TOKEN_KEY = 'linklater_token';
const REFRESH_TOKEN_KEY = 'linklater_refresh_token';

/**
 * Keys whose in-memory copy this tab could not persist. A store can serve
 * reads while refusing writes – quota exhaustion does it, and so do some
 * Safari private-browsing and ITP states – and there whatever is still in
 * storage is older than what this tab holds, not newer.
 */
const unpersistedKeys = new Set<string>();

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

/**
 * Safely writes to `localStorage`, recording whether the store took the
 * value. A refused write leaves the in-memory copy as the only current one,
 * so the key is marked and read back from memory until a write lands or
 * another tab supersedes it.
 */
function safeWrite(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
    unpersistedKeys.delete(key);
  } catch {
    unpersistedKeys.add(key);
  }
}

/**
 * Safely removes from `localStorage`, recording whether the store took the
 * removal. A refused removal is marked so the cleared token cannot come
 * back from storage on the next read – a logout has to stick.
 */
function safeRemove(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key);
    unpersistedKeys.delete(key);
  } catch {
    unpersistedKeys.add(key);
  }
}

let cachedToken: string | null = safeRead(TOKEN_KEY);
let cachedRefreshToken: string | null = safeRead(REFRESH_TOKEN_KEY);

/**
 * Resolves a token to the newest copy this tab knows of.
 *
 * A key this tab wrote or cleared without reaching storage answers from
 * memory: the store still holds the value from before that change, so
 * preferring it would discard a fresh rotation, or resurrect a token that
 * was already cleared. Otherwise the persisted copy wins, and that is what
 * carries a rotation performed in another tab into this one – the in-memory
 * copy alone would go stale the moment a sibling renewed the pair, leaving
 * this tab to send a refresh token that is already spent server-side. A
 * `null` read means absent, unreadable, or removed by another tab – never
 * proof the session ended, so the token this tab holds survives it.
 */
function readPersisted(key: string, cached: string | null): string | null {
  if (unpersistedKeys.has(key)) return cached;
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

/**
 * Persists the pair, refresh token first. The two writes are not atomic, so
 * another tab can read between them, and the order decides how bad that
 * torn read is: (old access, new refresh) leaves it an access token good
 * for the rest of its hour, while the reverse order leaves it holding a
 * refresh token this tab has already spent, so its next renewal 401s into
 * the logout this sync exists to prevent.
 */
export function setStoredToken(
  accessToken: string,
  refreshToken?: string,
): void {
  if (refreshToken !== undefined) {
    cachedRefreshToken = refreshToken;
    safeWrite(REFRESH_TOKEN_KEY, refreshToken);
  }

  cachedToken = accessToken;
  safeWrite(TOKEN_KEY, accessToken);
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
 * work – and that work is newer than a write of this tab's that storage
 * refused, which is why the event key stops being memory-authoritative
 * here. The store is re-read rather than trusting the event payload, so the
 * rule that a `null` never evicts a live token lives in a single place.
 */
function handleTokenStorageEvent(event: StorageEvent): void {
  if (event.key !== TOKEN_KEY && event.key !== REFRESH_TOKEN_KEY) return;
  unpersistedKeys.delete(event.key);
  cachedToken = readPersisted(TOKEN_KEY, cachedToken);
  cachedRefreshToken = readPersisted(REFRESH_TOKEN_KEY, cachedRefreshToken);
}

function startCrossTabTokenSync(): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('storage', handleTokenStorageEvent);
}

startCrossTabTokenSync();

/**
 * Exists for suites that re-import this module: without it each import
 * leaves another listener on the shared `window`. The app never stops
 * syncing while it runs, which is why this is absent from the `core.ts` and
 * `index.ts` barrels.
 */
export function stopCrossTabTokenSync(): void {
  if (typeof window === 'undefined') return;
  window.removeEventListener('storage', handleTokenStorageEvent);
}
