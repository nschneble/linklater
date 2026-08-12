/**
 * The API base URL, and the token store behind the API client along with
 * the precedence rule between the two copies it keeps: one in
 * `localStorage`, one in memory.
 *
 * The persisted copy normally wins, which is what carries a rotation
 * performed in another tab into this one. A store can serve reads while
 * refusing writes, though (quota exhaustion does it, and so do some Safari
 * private-browsing and ITP states), and there the persisted copy is older
 * than what this tab holds. Every refused change is recorded against what
 * the store held at the time, so a later read can tell a store that has
 * not moved since (memory is newer) from one a sibling has written since
 * (the store is newer).
 *
 * A read answering `null` means absent, unreadable, or removed by another
 * tab. None of those is proof the session ended, so the token this tab
 * holds survives it.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string;

if (!API_BASE_URL) {
  console.warn('VITE_API_BASE_URL is not set');
}

export { API_BASE_URL };

const TOKEN_KEY = 'linklater_token';
const REFRESH_TOKEN_KEY = 'linklater_refresh_token';

/**
 * Keys whose in-memory copy this tab could not persist, each mapped to
 * what the store held when it refused.
 */
const refusedWrites = new Map<string, string | null>();

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
 * Safely writes to `localStorage`, recording a refusal against what the
 * store held at the time. Clearing the record on a landed write is what
 * keeps the map's own claim true; no read can observe it either way, since
 * a landed write leaves the two copies equal and the comparison in
 * `isPersistedAuthoritative` answers the same with the record or without.
 */
function safeWrite(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
    refusedWrites.delete(key);
  } catch {
    refusedWrites.set(key, safeRead(key));
  }
}

/**
 * Safely removes from `localStorage`, recording a refusal the same way a
 * write does. The stake differs: an unrecorded refusal here would let the
 * next read resurrect the token this tab just cleared, so a logout sticks
 * for as long as the tab lives (a reload reads the store afresh and finds
 * the removal never landed).
 */
function safeRemove(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key);
    refusedWrites.delete(key);
  } catch {
    refusedWrites.set(key, safeRead(key));
  }
}

let cachedToken: string | null = safeRead(TOKEN_KEY);
let cachedRefreshToken: string | null = safeRead(REFRESH_TOKEN_KEY);

/**
 * Whether the store's copy of `key` is the newest one this tab knows of.
 *
 * With a refusal outstanding, the store having moved off the value it
 * refused against is the evidence another tab wrote it, and the only
 * evidence available before the `storage` event arrives.
 */
function isPersistedAuthoritative(
  key: string,
  persisted: string | null,
): boolean {
  if (persisted === null) return false;
  if (!refusedWrites.has(key)) return true;
  return persisted !== refusedWrites.get(key);
}

// resolves a token to the newest copy this tab knows of
function readPersisted(key: string, cached: string | null): string | null {
  const persisted = safeRead(key);
  if (!isPersistedAuthoritative(key, persisted)) return cached;
  return persisted;
}

export function getStoredToken(): string | null {
  return readPersisted(TOKEN_KEY, cachedToken);
}

export function getStoredRefreshToken(): string | null {
  return readPersisted(REFRESH_TOKEN_KEY, cachedRefreshToken);
}

/**
 * Whether this tab now knows a refresh token other than the one just
 * spent. A 401 on a token another tab has already replaced proves that
 * token spent, not that the session ended, so the successor is worth
 * trying. Asked through the same precedence rule the token was read
 * through, since a successor can arrive by either route: persisted by the
 * other tab, or carried into memory by the `storage` event. Nothing at all
 * is not a successor, so `null` reads as no.
 */
export function isRefreshTokenSuperseded(spentToken: string): boolean {
  const current = getStoredRefreshToken();
  return current !== null && current !== spentToken;
}

/**
 * Persists the pair, refresh token first. The two writes are not atomic,
 * so another tab can read between them, and the order decides how bad
 * that torn read is: (old access, new refresh) leaves it an access token
 * good for the rest of its hour, while the reverse order leaves it
 * holding a refresh token this tab has already spent, so its next renewal
 * 401s into the logout this sync exists to prevent.
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
 * work, but not necessarily work newer than this tab's: the event is
 * delivered as a queued task, so a sibling's write can arrive after a
 * rotation this tab performed in the gap. An outstanding refusal is
 * therefore left standing, and the value comparison below decides which
 * copy is newer, exactly as a read taken before the event would.
 *
 * The store is re-read rather than trusting the event payload, so the rule
 * that a `null` never evicts a live token lives in a single place.
 */
function handleTokenStorageEvent(event: StorageEvent): void {
  if (event.key !== TOKEN_KEY && event.key !== REFRESH_TOKEN_KEY) return;
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
 * syncing while it runs, which is why this is absent from the `core.ts`
 * and `index.ts` barrels.
 */
export function stopCrossTabTokenSync(): void {
  if (typeof window === 'undefined') return;
  window.removeEventListener('storage', handleTokenStorageEvent);
}
