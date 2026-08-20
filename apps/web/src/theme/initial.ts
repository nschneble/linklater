import { getSystemMode } from './systemMode';
import {
  LAST_SEEN_SYSTEM_MODE_KEY,
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
 * Returns the mode this device should paint. A stored mode the OS has
 * since moved away from is adopted when it matches the OS value last seen
 * here, marking it as followed rather than chosen. Anything else is
 * honored as stored, or read from the OS when nothing was.
 */
export function getInitialMode(): Mode {
  const stored = readLocalStorage(MODE_STORAGE_KEY);
  if (stored !== 'light' && stored !== 'dark') return getSystemMode();

  const systemMode = getSystemMode();
  if (stored === systemMode) return stored;
  if (stored === readLocalStorage(LAST_SEEN_SYSTEM_MODE_KEY)) return systemMode;
  return stored;
}
