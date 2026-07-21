const PENDING_SAVE_KEY = 'linklater:pendingSave';

// A stashed save older than a day is almost certainly abandoned; draining it
// into a fresh session would surprise the user with a link they forgot about.
const PENDING_SAVE_TTL_MS = 24 * 60 * 60 * 1000;

interface PendingSave {
  url: string;
  at: number;
}

/**
 * Stashes the url of a logged-out save so it survives the bounce to `/login`.
 *
 * A dropped write (private mode, quota) just means the save won't resume, so a
 * throwing `localStorage` is swallowed rather than surfaced.
 */
export function setPendingSave(url: string): void {
  try {
    const entry: PendingSave = { url, at: Date.now() };
    localStorage.setItem(PENDING_SAVE_KEY, JSON.stringify(entry));
  } catch {
    // No stash means no resume, which is acceptable.
  }
}

/**
 * Reads and clears the stashed save. Returns the url only when the entry is
 * present, well-formed, and within the TTL; otherwise clears whatever is there
 * and returns null.
 *
 * The clear happens before validation so a stale or malformed entry can't
 * linger and re-fire on a later load.
 */
export function takePendingSave(): string | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(PENDING_SAVE_KEY);
  } catch {
    return null;
  }
  if (raw === null) return null;

  clearPendingSave();

  try {
    const entry = JSON.parse(raw) as Partial<PendingSave>;
    if (typeof entry.url !== 'string' || typeof entry.at !== 'number') {
      return null;
    }
    if (Date.now() - entry.at > PENDING_SAVE_TTL_MS) return null;
    return entry.url;
  } catch {
    return null;
  }
}

/** Removes the stashed save, tolerating a throwing `localStorage`. */
export function clearPendingSave(): void {
  try {
    localStorage.removeItem(PENDING_SAVE_KEY);
  } catch {
    // Nothing to clear if storage is unavailable.
  }
}
