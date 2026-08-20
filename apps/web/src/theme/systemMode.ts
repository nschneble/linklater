import { MODE_STORAGE_KEY, readLocalStorage } from './storage';
import { useEffect, useLayoutEffect, useRef } from 'react';
import type { Mode } from './constants';

const SYSTEM_LIGHT_MODE_QUERY = '(prefers-color-scheme: light)';

/**
 * The OS-level color scheme, defaulting to `'dark'` when the media query is
 * unavailable (SSR, or a runtime without `matchMedia`).
 */
export function getSystemMode(): Mode {
  if (
    typeof window === 'undefined' ||
    typeof window.matchMedia !== 'function'
  ) {
    return 'dark';
  }
  return window.matchMedia(SYSTEM_LIGHT_MODE_QUERY).matches ? 'light' : 'dark';
}

/**
 * Whether this device is following its system rather than sitting on an
 * explicit choice. Derived by comparison, so a choice that the OS later
 * agrees with collapses back into following it.
 */
export function isFollowingSystemMode(): boolean {
  return readLocalStorage(MODE_STORAGE_KEY) === getSystemMode();
}

/**
 * Calls `adoptSystemMode` with the new OS color scheme whenever it changes.
 *
 * Adoption is unconditional: the stored mode is either the old OS value, in
 * which case this device is following the system, or already the new one, in
 * which case adopting it changes nothing. Either way the device ends up
 * following the system, so there is nothing to compare.
 */
export function useSystemModeSync(
  adoptSystemMode: (systemMode: Mode) => void,
): void {
  const adopt = useRef(adoptSystemMode);
  useLayoutEffect(() => {
    adopt.current = adoptSystemMode;
  }, [adoptSystemMode]);

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function'
    ) {
      return;
    }
    const query = window.matchMedia(SYSTEM_LIGHT_MODE_QUERY);
    const listener = (event: MediaQueryListEvent) =>
      adopt.current(event.matches ? 'light' : 'dark');
    query.addEventListener('change', listener);
    return () => query.removeEventListener('change', listener);
  }, []);
}
