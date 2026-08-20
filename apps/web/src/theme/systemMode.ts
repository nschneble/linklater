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
 * Whether a tab painting `paintedMode` is following its system rather than
 * sitting on an explicit choice, so a choice the OS later agrees with
 * collapses into following it. Compared against what this tab paints, never
 * storage, which a sibling tab can move out from under it.
 */
export function isFollowingSystemMode(paintedMode: Mode): boolean {
  return paintedMode === getSystemMode();
}

// unlike applyServerMode, no guard: the OS decides its own device
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
