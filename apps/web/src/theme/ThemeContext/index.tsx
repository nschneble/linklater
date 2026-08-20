import { createContext, useContext, type ReactNode } from 'react';

import {
  CVD_BASE_THEME,
  pickerThemes,
  THEMES,
  VALID_BASE_THEME_IDS,
  type BaseTheme,
  type Mode,
} from '../constants';
import { getInitialBaseTheme, getInitialMode } from '../initial';
import { useOptionalAuth } from '../../auth/AuthContext';
import { useThemeState } from './useThemeState';
import type { CustomTheme } from '../customTheme';
import type { ThemeContextValue } from './types';

export {
  CVD_BASE_THEME,
  THEMES,
  VALID_BASE_THEME_IDS,
  pickerThemes,
  getInitialBaseTheme,
  getInitialMode,
};
export type { BaseTheme, CustomTheme, Mode };

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

/**
 * Provides theme and color-mode state to the component tree. Applies the
 * active theme and mode as `data-theme` and `data-mode` attributes on
 * `document.documentElement` so that CSS variables defined in the theme
 * stylesheets cascade to the entire page.
 *
 * User-initiated changes (via `setBaseTheme`, `setMode`, `toggleMode`)
 * write a timestamp to `localStorage` alongside the value. The server sync
 * path (`applyServerTheme`, `applyServerMode`) checks that timestamp and
 * skips the update if a local change is less than 30 seconds old. This
 * prevents a hard page refresh, made before an optimistic
 * `PATCH /users/me` resolves, from reverting the user's choice back to the
 * stale server value.
 *
 * Color mode has two more writers, both device-local and neither synced to
 * the account: `useSystemModeSync` adopts an OS appearance change, and
 * boot reconciles a stored mode against the OS value the device last saw.
 * `applyServerMode` declines outright while the device is following its
 * OS, so the account's mode reaches only a device that chose one.
 *
 * @param children - The subtree that should have access to theme state.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  // read auth non-throwingly: ThemeProvider is mounted bare in some tests
  const auth = useOptionalAuth();
  const value = useThemeState(auth?.user != null);

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

/**
 * Provides access to theme state and actions from any component within the
 * `ThemeProvider` tree.
 *
 * @throws {Error} When called outside of a `ThemeProvider`.
 */
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');

  return context;
}

/**
 * Non-throwing variant for purely presentational leaf primitives (e.g.
 * `Alert`, `StatusBadge`) that only need `baseTheme` and `mode` for class
 * selection.
 *
 * Safe to call outside of a `ThemeProvider`: falls back to
 * `{ baseTheme: 'scanner-darkly', mode: 'light' }`, which resolves to the
 * `default` style branch in callers - the same styling production users see
 * for themes that have no per-theme override. This keeps test environments
 * working without forcing every caller to wrap in a provider.
 *
 * Use `useTheme` instead whenever you need theme actions, CVD state, or
 * server-sync behavior - those must be inside a `ThemeProvider`.
 */
export function useThemeStyling(): { baseTheme: BaseTheme; mode: Mode } {
  const context = useContext(ThemeContext);
  if (!context) return { baseTheme: 'scanner-darkly', mode: 'light' };

  return { baseTheme: context.baseTheme, mode: context.mode };
}
