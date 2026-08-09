import {
  MODE_STORAGE_KEY,
  readLocalStorage,
  THEME_STORAGE_KEY,
} from './storage';
import { VALID_BASE_THEME_IDS, type BaseTheme, type Mode } from './constants';

/**
 * Returns the theme that was last stored in `localStorage`, falling back
 * to `'scanner-darkly'` for first-time visitors.
 */
export function getInitialBaseTheme(): BaseTheme {
  const stored = readLocalStorage(THEME_STORAGE_KEY);
  if (stored && VALID_BASE_THEME_IDS.has(stored)) return stored as BaseTheme;
  return 'scanner-darkly';
}

/**
 * Returns the mode that was last stored in `localStorage`. Falls back to
 * the OS preference (`prefers-color-scheme`) for first-time visitors,
 * defaulting to `'dark'` when the media query is not available.
 */
export function getInitialMode(): Mode {
  const stored = readLocalStorage(MODE_STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  if (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-color-scheme: light)').matches
  ) {
    return 'light';
  }
  return 'dark';
}
