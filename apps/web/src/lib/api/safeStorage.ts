/**
 * `localStorage` access that survives a store refusing to co-operate, and
 * the rule deciding which of the two copies of a value is the newer one.
 *
 * A store can serve reads while refusing writes (quota exhaustion does it,
 * and so do some Safari private-browsing and ITP states), and there the
 * persisted copy is older than what this tab holds. Every refused change is
 * recorded against what the store held at the time, so a later read can
 * tell a store that has not moved since (memory is newer) from one a
 * sibling has written since (the store is newer).
 *
 * A read answering `null` means absent, unreadable, or removed by another
 * tab. None of those is proof of anything, so the caller's own copy
 * survives it.
 */

/**
 * Keys whose in-memory copy this tab could not persist, each mapped to
 * what the store held when it refused.
 */
const refusedWrites = new Map<string, string | null>();

/**
 * Safely reads from `localStorage`. Returns `null` in SSR environments or
 * when the read fails (e.g. Safari private browsing throws on access).
 */
export function safeRead(key: string): string | null {
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
export function safeWrite(key: string, value: string): void {
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
export function safeRemove(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key);
    refusedWrites.delete(key);
  } catch {
    refusedWrites.set(key, safeRead(key));
  }
}

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

// resolves a value to the newest copy this tab knows of
export function readPersisted(
  key: string,
  cached: string | null,
): string | null {
  const persisted = safeRead(key);
  if (!isPersistedAuthoritative(key, persisted)) return cached;
  return persisted;
}
