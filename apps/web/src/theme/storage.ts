/** `localStorage` key for persisting the selected theme across sessions. */
export const THEME_STORAGE_KEY = 'linklater_theme';
/** `localStorage` key for persisting the selected color mode across sessions. */
export const MODE_STORAGE_KEY = 'linklater_mode';
/** Timestamp written alongside the theme when a user action changes it. */
export const THEME_UPDATED_AT_KEY = 'linklater_theme_updated_at';
/** Timestamp written alongside the mode when a user action changes it. */
export const MODE_UPDATED_AT_KEY = 'linklater_mode_updated_at';
/**
 * The OS color scheme as of the last time this device saw it, so a boot
 * can tell a mode the OS moved away from apart from one the user chose.
 */
export const LAST_SEEN_SYSTEM_MODE_KEY = 'linklater_last_seen_system_mode';
/** Whether CVD mode is explicitly on. */
export const CVD_MODE_KEY = 'linklater_cvd_mode';
/** The theme that was active before CVD mode was enabled. */
export const PRE_CVD_THEME_KEY = 'linklater_pre_cvd_theme';
/** Timestamp written when CVD mode is toggled; used as race guard in App.tsx. */
export const CVD_UPDATED_AT_KEY = 'linklater_cvd_updated_at';
/** Whether the OpenDyslexic font override is explicitly on. */
export const DYSLEXIC_FONT_KEY = 'linklater_dyslexic_font';
/**
 * Timestamp written when the dyslexic-font override is toggled; used as the
 * race guard in App.tsx, mirroring `CVD_UPDATED_AT_KEY`.
 */
export const DYSLEXIC_FONT_UPDATED_AT_KEY =
  'linklater_dyslexic_font_updated_at';
/**
 * `localStorage` key for the user's editable Custom theme: a JSON-encoded
 * `{ dark, light }` map of bundle token names to CSS color strings.
 */
export const CUSTOM_THEME_STORAGE_KEY = 'linklater_custom_theme';
/** Timestamp written alongside the Custom theme when a user action changes it. */
export const CUSTOM_THEME_UPDATED_AT_KEY = 'linklater_custom_theme_updated_at';
/**
 * Whether the user has opted the Custom theme into the theme picker (`'on'`).
 * The Custom theme is always editable in the Theme Editor; this flag only
 * controls whether it appears in the picker menus.
 */
export const CUSTOM_THEME_ENABLED_KEY = 'linklater_custom_theme_enabled';
/** Timestamp written when the Custom-theme picker opt-in is toggled. */
export const CUSTOM_THEME_ENABLED_UPDATED_AT_KEY =
  'linklater_custom_theme_enabled_updated_at';

/**
 * If the user changed a preference less than this many milliseconds ago,
 * the server sync in `App.tsx` will not override it. 30s is well beyond
 * any realistic `updateMe` round-trip time.
 */
export const RECENT_LOCAL_CHANGE_MS = 30_000;

/**
 * Safely reads from `localStorage`. Returns `null` in SSR environments or
 * when the read fails (e.g. private browsing with blocked storage).
 */
export function readLocalStorage(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Keys this tab could not persist, each mapped to what the store held when
 * it refused. A refusal is the only evidence a later read has that the
 * store's copy is older than the state this tab is showing.
 */
const refusedWrites = new Map<string, string | null>();

/**
 * Safely writes to `localStorage`. Does nothing when the write is refused
 * (blocked storage, a full quota). The theme provider mounts above every
 * `ErrorBoundary`, so an unguarded write reached from its boot layout
 * effect, or from the server-sync effect in `App.tsx`, is a blank page.
 */
export function writeLocalStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
    refusedWrites.delete(key);
  } catch {
    refusedWrites.set(key, readLocalStorage(key));
  }
}

/**
 * The newest copy of `key` this tab knows of. Unreadable, absent, and a
 * value this tab failed to write over all resolve to `cachedValue`: a
 * refused write leaves live state ahead of the store. A stored value that
 * differs from the one the refusal saw is another tab's, and wins.
 */
export function readPersistedValue(key: string, cachedValue: string): string {
  const persisted = readLocalStorage(key);
  if (persisted === null) return cachedValue;
  if (refusedWrites.has(key) && persisted === refusedWrites.get(key)) {
    return cachedValue;
  }

  return persisted;
}

/**
 * Safely removes a key, mirroring `writeLocalStorage`. `removeItem` throws
 * under a blocked store exactly as `setItem` does, so a sync path that
 * clears a preference needs a guard of its own.
 */
export function removeLocalStorage(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    return;
  }
}

/**
 * Returns `true` when the preference tracked by `updatedAtKey` was changed
 * locally within the last `RECENT_LOCAL_CHANGE_MS`. The server-sync effects in
 * `useThemeState` (`applyServer*`) and `useServerBooleanPrefSync` call this to
 * skip a server value that would otherwise stomp a just-made optimistic local
 * change.
 */
export function hasRecentLocalChange(updatedAtKey: string): boolean {
  const updatedAt = parseInt(readLocalStorage(updatedAtKey) ?? '0', 10);
  return Date.now() - updatedAt < RECENT_LOCAL_CHANGE_MS;
}

interface PersistWithTimestampInput {
  valueKey: string;
  value: string;
  updatedAtKey: string;
}

/**
 * Persists a preference `value` under `valueKey` and stamps the current time
 * under `updatedAtKey`, so the `hasRecentLocalChange` guard can later suppress
 * a stale server sync. The `applyServer*` syncs and the system-mode paths
 * write the value alone, so they never reset their own guard window.
 *
 * Takes a named-argument object rather than three positional `string`s. With
 * all three parameters sharing the `string` type, positional arguments let a
 * caller silently transpose the two key slots (`valueKey`/`updatedAtKey`) or
 * drop the value into a key slot without any type error. Naming each slot at
 * the call site makes that transposition unexpressible.
 */
export function persistWithTimestamp({
  valueKey,
  value,
  updatedAtKey,
}: PersistWithTimestampInput): void {
  writeLocalStorage(valueKey, value);
  writeLocalStorage(updatedAtKey, Date.now().toString());
}
