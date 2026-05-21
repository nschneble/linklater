import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  CVD_MODE_KEY,
  CVD_UPDATED_AT_KEY,
  MODE_UPDATED_AT_KEY,
  PRE_CVD_THEME_KEY,
  RECENT_LOCAL_CHANGE_MS,
  THEME_STORAGE_KEY,
  THEME_UPDATED_AT_KEY,
  MODE_STORAGE_KEY,
  readLocalStorage,
} from './storage';
import {
  CVD_BASE_THEME,
  THEMES,
  VALID_BASE_THEME_IDS,
  type BaseTheme,
  type Mode,
} from './constants';
import { getInitialBaseTheme, getInitialMode } from './initial';

// Re-export so the long list of existing consumers can keep importing
// from `../../theme/ThemeContext` without churn.
export {
  CVD_BASE_THEME,
  THEMES,
  VALID_BASE_THEME_IDS,
  getInitialBaseTheme,
  getInitialMode,
};
export type { BaseTheme, Mode };

/**
 * The shape of the value provided by `ThemeContext`. All theme-related
 * state and actions are accessed through this interface via `useTheme`.
 */
interface ThemeContextValue {
  /** The currently active base theme. */
  baseTheme: BaseTheme;
  /** The current color mode. */
  mode: Mode;
  /**
   * Sets the base theme from a user action. Persists to `localStorage`
   * with a timestamp so a subsequent server sync cannot overwrite a very
   * recent change.
   *
   * If CVD mode is currently on and the user picks a non-Apollo theme,
   * CVD mode is automatically cleared.
   */
  setBaseTheme: (theme: BaseTheme) => void;
  /**
   * Sets the color mode from a user action. Persists to `localStorage`
   * with a timestamp so a subsequent server sync cannot overwrite a very
   * recent change.
   */
  setMode: (mode: Mode) => void;
  /**
   * Toggles between `'light'` and `'dark'`. Writes a timestamp like
   * `setMode`.
   */
  toggleMode: () => void;
  /**
   * Applies the server-stored theme preference. Skips the update if the
   * user changed the theme locally within the last 30 seconds as a race
   * condition guard for optimistic updates that may not have reached the
   * server before a reload.
   */
  applyServerTheme: (theme: BaseTheme) => void;
  /**
   * Applies the server-stored mode preference. Skips the update if the
   * user changed the mode locally within the last 30 seconds.
   */
  applyServerMode: (mode: Mode) => void;
  /**
   * Enables CVD mode: saves the current theme as the pre-CVD theme,
   * switches to Apollo 10½, and sets `data-cvd="on"` on the document root.
   * Returns the resolved theme (`'apollo-10-1-2'`) so callers can include
   * it in server PATCH payloads.
   */
  enableCvdMode: () => BaseTheme;
  /**
   * Disables CVD mode: restores the pre-CVD theme (or `'scanner-darkly'`
   * if none was saved or the stored value is invalid), removes `data-cvd`,
   * and clears the related `localStorage` keys. Returns the restored theme
   * so callers can include it in server PATCH payloads.
   */
  disableCvdMode: () => BaseTheme;
  /** Whether CVD mode is currently active. */
  isCvdMode: boolean;
}

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
 * @param children - The subtree that should have access to theme state.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [baseTheme, setBaseThemeState] =
    useState<BaseTheme>(getInitialBaseTheme);
  const [mode, setModeState] = useState<Mode>(getInitialMode);
  const [isCvdMode, setisCvdMode] = useState<boolean>(
    () => readLocalStorage(CVD_MODE_KEY) === 'on',
  );

  // Ref to always have the current baseTheme available in callbacks
  // without them needing to be recreated on every theme change.
  const baseThemeRef = useRef<BaseTheme>(baseTheme);
  useLayoutEffect(() => {
    baseThemeRef.current = baseTheme;
  }, [baseTheme]);

  // useLayoutEffect ensures data-theme/data-mode are set before any child
  // useEffect reads getComputedStyle (e.g. useThemeOverrides).
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = baseTheme;
    document.documentElement.dataset.mode = mode;
  }, [baseTheme, mode]);

  useLayoutEffect(() => {
    if (isCvdMode) {
      document.documentElement.dataset.cvd = 'on';
    } else {
      delete document.documentElement.dataset.cvd;
    }
  }, [isCvdMode]);

  const setBaseTheme = useCallback(
    (theme: BaseTheme) => {
      setBaseThemeState(theme);
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
      window.localStorage.setItem(THEME_UPDATED_AT_KEY, Date.now().toString());

      // If the user manually switches away from Apollo while CVD mode
      // is on, clear CVD mode so the two don't become out-of-sync.

      if (isCvdMode && theme !== CVD_BASE_THEME) {
        setisCvdMode(false);
        window.localStorage.setItem(CVD_MODE_KEY, 'off');
        window.localStorage.removeItem(PRE_CVD_THEME_KEY);
      }
    },
    [isCvdMode],
  );

  const setMode = useCallback((newMode: Mode) => {
    setModeState(newMode);
    window.localStorage.setItem(MODE_STORAGE_KEY, newMode);
    window.localStorage.setItem(MODE_UPDATED_AT_KEY, Date.now().toString());
  }, []);

  const toggleMode = useCallback(() => {
    setModeState((current) => {
      const next = current === 'light' ? 'dark' : 'light';
      window.localStorage.setItem(MODE_STORAGE_KEY, next);
      window.localStorage.setItem(MODE_UPDATED_AT_KEY, Date.now().toString());
      return next;
    });
  }, []);

  const applyServerTheme = useCallback((theme: BaseTheme) => {
    const updatedAt = parseInt(
      readLocalStorage(THEME_UPDATED_AT_KEY) ?? '0',
      10,
    );
    if (Date.now() - updatedAt < RECENT_LOCAL_CHANGE_MS) return;
    setBaseThemeState(theme);
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, []);

  const applyServerMode = useCallback((serverMode: Mode) => {
    const updatedAt = parseInt(
      readLocalStorage(MODE_UPDATED_AT_KEY) ?? '0',
      10,
    );
    if (Date.now() - updatedAt < RECENT_LOCAL_CHANGE_MS) return;
    setModeState(serverMode);
    window.localStorage.setItem(MODE_STORAGE_KEY, serverMode);
  }, []);

  const enableCvdMode = useCallback((): BaseTheme => {
    const current = baseThemeRef.current;
    if (current !== CVD_BASE_THEME) {
      window.localStorage.setItem(PRE_CVD_THEME_KEY, current);
    }
    setBaseThemeState(CVD_BASE_THEME);
    window.localStorage.setItem(THEME_STORAGE_KEY, CVD_BASE_THEME);
    window.localStorage.setItem(THEME_UPDATED_AT_KEY, Date.now().toString());
    window.localStorage.setItem(CVD_MODE_KEY, 'on');
    window.localStorage.setItem(CVD_UPDATED_AT_KEY, Date.now().toString());
    setisCvdMode(true);
    return CVD_BASE_THEME;
  }, []);

  const disableCvdMode = useCallback((): BaseTheme => {
    const stored = readLocalStorage(PRE_CVD_THEME_KEY);
    const previousTheme: BaseTheme =
      stored && VALID_BASE_THEME_IDS.has(stored)
        ? (stored as BaseTheme)
        : 'scanner-darkly';
    setBaseThemeState(previousTheme);
    window.localStorage.setItem(THEME_STORAGE_KEY, previousTheme);
    window.localStorage.setItem(THEME_UPDATED_AT_KEY, Date.now().toString());
    window.localStorage.setItem(CVD_MODE_KEY, 'off');
    window.localStorage.setItem(CVD_UPDATED_AT_KEY, Date.now().toString());
    window.localStorage.removeItem(PRE_CVD_THEME_KEY);
    setisCvdMode(false);
    return previousTheme;
  }, []);

  const value = useMemo(
    () => ({
      applyServerMode,
      applyServerTheme,
      baseTheme,
      disableCvdMode,
      enableCvdMode,
      isCvdMode,
      mode,
      setBaseTheme,
      setMode,
      toggleMode,
    }),
    [
      applyServerMode,
      applyServerTheme,
      baseTheme,
      disableCvdMode,
      enableCvdMode,
      isCvdMode,
      mode,
      setBaseTheme,
      setMode,
      toggleMode,
    ],
  );

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
 * `default` style branch in callers — the same styling production users see
 * for themes that have no per-theme override. This keeps test environments
 * working without forcing every caller to wrap in a provider.
 *
 * Use `useTheme` instead whenever you need theme actions, CVD state, or
 * server-sync behavior — those must be inside a `ThemeProvider`.
 */
export function useThemeStyling(): { baseTheme: BaseTheme; mode: Mode } {
  const context = useContext(ThemeContext);
  if (!context) return { baseTheme: 'scanner-darkly', mode: 'light' };

  return { baseTheme: context.baseTheme, mode: context.mode };
}
