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
  MODE_STORAGE_KEY,
  MODE_UPDATED_AT_KEY,
  PRE_CVD_THEME_KEY,
  RECENT_LOCAL_CHANGE_MS,
  THEME_STORAGE_KEY,
  THEME_UPDATED_AT_KEY,
  readLocalStorage,
} from './storage';

/**
 * All valid theme identifiers, each mapping to a Richard Linklater film.
 * Adding a new theme requires updating this union, the `THEMES` array,
 * `VALID_THEMES` in `apps/api/src/users/users.constants.ts`, and the
 * matching CSS variable file in `apps/web/src/theme/styles/`.
 */
export type BaseTheme =
  | 'apollo-10-1-2'
  | 'before-midnight'
  | 'before-sunrise'
  | 'before-sunset'
  | 'boyhood'
  | 'dazed-and-confused'
  | 'hit-man'
  | 'nouvelle-vague'
  | 'scanner-darkly'
  | 'school-of-rock';

/** The two color modes. */
export type Mode = 'light' | 'dark';

/** The theme id for the Apollo 10½ CVD-friendly theme. */
export const CVD_BASE_THEME: BaseTheme = 'apollo-10-1-2';

/**
 * All available themes with their display labels, accent colors, swatch
 * icons, and accessibility flag. The accent color is used for the color dot
 * in the theme submenu; the swatch icon is overlaid on the dot for quick
 * visual identification.
 */
export const THEMES: Array<{
  id: BaseTheme;
  label: string;
  accent: string;
  swatchIcon: string;
  isAccessible?: boolean;
}> = [
  {
    id: 'apollo-10-1-2',
    label: 'Apollo 10½',
    accent: '#4e89c9',
    swatchIcon: 'fa-rocket',
    isAccessible: true,
  },
  {
    id: 'scanner-darkly',
    label: 'A Scanner Darkly',
    accent: '#a3e635',
    swatchIcon: 'fa-eye',
  },
  {
    id: 'before-sunrise',
    label: 'Before Sunrise',
    accent: '#b45309',
    swatchIcon: 'fa-sun',
  },
  {
    id: 'before-sunset',
    label: 'Before Sunset',
    accent: '#d97706',
    swatchIcon: 'fa-cloud-sun',
  },
  {
    id: 'before-midnight',
    label: 'Before Midnight',
    accent: '#f59e0b',
    swatchIcon: 'fa-moon',
  },
  {
    id: 'boyhood',
    label: 'Boyhood',
    accent: '#86efac',
    swatchIcon: 'fa-child-reaching',
  },
  {
    id: 'dazed-and-confused',
    label: 'Dazed and Confused',
    accent: '#dc2626',
    swatchIcon: 'fa-fire',
  },
  {
    id: 'hit-man',
    label: 'Hit Man',
    accent: '#f59e0b',
    swatchIcon: 'fa-user-secret',
  },
  {
    id: 'nouvelle-vague',
    label: 'Nouvelle Vague (Noir)',
    accent: '#555555',
    swatchIcon: 'fa-clapperboard',
  },
  {
    id: 'school-of-rock',
    label: 'School of Rock',
    accent: '#b91c1c',
    swatchIcon: 'fa-guitar',
  },
];

export const VALID_BASE_THEME_IDS = new Set<string>(
  THEMES.map((theme) => theme.id),
);

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
