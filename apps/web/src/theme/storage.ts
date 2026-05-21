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
