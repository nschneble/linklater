/** `localStorage` key for persisting the selected theme across sessions. */
export const THEME_STORAGE_KEY = 'linklater_theme';
/** `localStorage` key for persisting the selected color mode across sessions. */
export const MODE_STORAGE_KEY = 'linklater_mode';
/** Timestamp written alongside the theme when a user action changes it. */
export const THEME_UPDATED_AT_KEY = 'linklater_theme_updated_at';
/** Timestamp written alongside the mode when a user action changes it. */
export const MODE_UPDATED_AT_KEY = 'linklater_mode_updated_at';
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
 * a stale server sync. Only user-initiated setters write the timestamp; the
 * `applyServer*` syncs write the value alone (via a bare `setItem`) so they
 * never reset their own guard window.
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
  window.localStorage.setItem(valueKey, value);
  window.localStorage.setItem(updatedAtKey, Date.now().toString());
}
