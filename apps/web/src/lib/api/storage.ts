/**
 * The API base URL, and the token store behind the API client along with
 * the precedence rule between the two copies it keeps: one in
 * `localStorage`, one in memory.
 *
 * The persisted copy normally wins, which is what carries a rotation
 * performed in another tab into this one. `safeStorage` owns the cases
 * where it does not, and answers `null` for a read it could not take. None
 * of the things a `null` can mean is proof the session ended, so the token
 * this tab holds survives it.
 */

import { readPersisted, safeRead, safeRemove, safeWrite } from './safeStorage';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string;

if (!API_BASE_URL) {
  console.warn('VITE_API_BASE_URL is not set');
}

export { API_BASE_URL };

const TOKEN_KEY = 'linklater_token';
const REFRESH_TOKEN_KEY = 'linklater_refresh_token';
const NOMINATED_REFRESH_TOKEN_KEY = 'linklater_nominated_refresh_token';

let cachedToken: string | null = safeRead(TOKEN_KEY);
let cachedRefreshToken: string | null = safeRead(REFRESH_TOKEN_KEY);
let cachedNomination: string | null = safeRead(NOMINATED_REFRESH_TOKEN_KEY);

export function getStoredToken(): string | null {
  return readPersisted(TOKEN_KEY, cachedToken);
}

export function getStoredRefreshToken(): string | null {
  return readPersisted(REFRESH_TOKEN_KEY, cachedRefreshToken);
}

/**
 * The successor this tab asked the server to rotate into, if it has one
 * outstanding. It is the only thing that can recover a rotation the server
 * committed and answered on a connection that died: the token the server
 * moved to is otherwise a value nobody here ever saw.
 */
export function getNominatedRefreshToken(): string | null {
  return readPersisted(NOMINATED_REFRESH_TOKEN_KEY, cachedNomination);
}

// the shape the server would have generated, from the browser's own CSPRNG
function generateHexToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(
    '',
  );
}

/**
 * The successor to send with the next renewal, minted and persisted here so
 * it is already durable by the time the request carrying it goes out. That
 * ordering is the whole point: a nomination written when the answer arrives
 * is gone in exactly the case it exists for.
 *
 * An outstanding nomination is reused rather than replaced. A renewal that
 * reached no verdict may have been committed against it, and a renewal that
 * followed would otherwise mint over the one token that could still get the
 * session back. Nothing weakens on reuse, since it stays 32 bytes only this
 * client has seen until the pair rotates or is cleared.
 */
export function nominateRefreshToken(): string {
  const outstanding = getNominatedRefreshToken();
  if (outstanding) return outstanding;

  cachedNomination = generateHexToken();
  safeWrite(NOMINATED_REFRESH_TOKEN_KEY, cachedNomination);
  return cachedNomination;
}

// a nomination outlives its own request, so nothing may outlive the pair
function clearNomination(): void {
  cachedNomination = null;
  safeRemove(NOMINATED_REFRESH_TOKEN_KEY);
}

/**
 * Whether this tab now knows a refresh token other than the one just
 * spent. A 401 on a token another tab has already replaced proves that
 * token spent, not that the session ended, so the successor is worth
 * trying. Asked through the same precedence rule the token was read
 * through, since a successor can arrive by either route: persisted by the
 * other tab, or carried into memory by the `storage` event. Nothing at all
 * is not a successor, so a `null` current reads as no; a caller that spent
 * nothing counts any stored token as one, since a sibling put it there.
 */
export function isRefreshTokenSuperseded(spentToken: string | null): boolean {
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
 *
 * A refresh token arriving means any nomination outstanding is moot,
 * whether it was spent on this rotation or belongs to a session this pair
 * replaces. Dropping it on every arrival rather than on a renewal alone is
 * what keeps a sign-in from leaving a live token behind for the account
 * that was here before. It is dropped after the token it is moot against
 * lands, for the same reason the pair is written in the order it is: a
 * sibling reading in between would otherwise be left with neither.
 */
export function setStoredToken(
  accessToken: string,
  refreshToken?: string,
): void {
  if (refreshToken !== undefined) {
    cachedRefreshToken = refreshToken;
    safeWrite(REFRESH_TOKEN_KEY, refreshToken);
    clearNomination();
  }

  cachedToken = accessToken;
  safeWrite(TOKEN_KEY, accessToken);
}

export function clearStoredToken(): void {
  clearNomination();
  cachedToken = null;
  cachedRefreshToken = null;
  safeRemove(TOKEN_KEY);
  safeRemove(REFRESH_TOKEN_KEY);
}

/**
 * Whether a `storage` event carries a change to the token pair, as opposed
 * to one of the dozen other keys this app keeps beside them (theme, mode,
 * CVD, dyslexic font, keyboard shortcuts, and a paired timestamp for
 * several of those). Exported because anything listening for a sibling's
 * sign-in has the same question and no other way to ask it.
 *
 * A `null` key is a whole-store `clear()`, which names no key at all and
 * so has to be read as possibly concerning the pair. It is not read as
 * the pair being gone: `readPersisted` answers that, and it keeps this
 * tab's copy, since an emptied store is not proof the session ended any
 * more than a single removal is.
 */
export function isTokenStorageEvent(event: StorageEvent): boolean {
  return (
    event.key === null ||
    event.key === TOKEN_KEY ||
    event.key === REFRESH_TOKEN_KEY
  );
}

/**
 * Pulls a sibling tab's rotation into the in-memory copy as it happens, so
 * a read taken after storage becomes unreadable still answers with the
 * rotated pair rather than the one read at boot. The `storage` event never
 * fires in the tab that wrote, so this only ever carries another tab's
 * work, but not necessarily work newer than this tab's: the event is
 * delivered as a queued task, so a sibling's write can arrive after a
 * rotation this tab performed in the gap. An outstanding refusal is
 * therefore left standing, and `readPersisted` decides which copy is
 * newer, exactly as a read taken before the event would.
 *
 * The store is re-read rather than trusting the event payload, so the rule
 * that a `null` never evicts a live token lives in a single place.
 */
function handleTokenStorageEvent(event: StorageEvent): void {
  if (!isTokenStorageEvent(event)) return;
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
