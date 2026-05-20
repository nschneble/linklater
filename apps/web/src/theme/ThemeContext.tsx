import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

/**
 * All valid theme identifiers, each mapping to a Richard Linklater film.
 * Adding a new theme requires updating this union, the `THEMES` array,
 * `VALID_THEMES` in `apps/api/src/users/users.constants.ts`, and the
 * matching CSS variable file in `apps/web/src/theme/styles/`.
 */
export type BaseTheme =
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

/**
 * All available themes with their display labels and accent colors. The
 * accent color is used purely for the color dot in the theme submenu.
 */
export const THEMES: Array<{ id: BaseTheme; label: string; accent: string }> = [
  { id: 'scanner-darkly', label: 'A Scanner Darkly', accent: '#a3e635' },
  { id: 'before-sunrise', label: 'Before Sunrise', accent: '#b45309' },
  { id: 'before-sunset', label: 'Before Sunset', accent: '#d97706' },
  { id: 'before-midnight', label: 'Before Midnight', accent: '#f59e0b' },
  { id: 'boyhood', label: 'Boyhood', accent: '#86efac' },
  { id: 'dazed-and-confused', label: 'Dazed and Confused', accent: '#dc2626' },
  { id: 'hit-man', label: 'Hit Man', accent: '#f59e0b' },
  { id: 'nouvelle-vague', label: 'Nouvelle Vague (Noir)', accent: '#555555' },
  { id: 'school-of-rock', label: 'School of Rock', accent: '#b91c1c' },
];

const VALID_BASE_THEME_IDS = new Set<string>(THEMES.map((theme) => theme.id));

/**
 * Safely reads from `localStorage`. Returns `null` in SSR environments or
 * when the read fails (e.g. private browsing with blocked storage).
 */
function readLocalStorage(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
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
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

/** `localStorage` key for persisting the selected theme across sessions. */
const THEME_STORAGE_KEY = 'linklater_theme';
/** `localStorage` key for persisting the selected color mode across sessions. */
const MODE_STORAGE_KEY = 'linklater_mode';
/** Timestamp written alongside the theme when a user action changes it. */
const THEME_UPDATED_AT_KEY = 'linklater_theme_updated_at';
/** Timestamp written alongside the mode when a user action changes it. */
const MODE_UPDATED_AT_KEY = 'linklater_mode_updated_at';

/**
 * If the user changed a preference less than this many milliseconds ago,
 * the server sync in `App.tsx` will not override it. 30s is well beyond
 * any realistic `updateMe` round-trip time.
 */
const RECENT_LOCAL_CHANGE_MS = 30_000;

/**
 * Returns the theme that was last stored in `localStorage`, falling back
 * to `'scanner-darkly'` for first-time visitors.
 */
function getInitialBaseTheme(): BaseTheme {
  const stored = readLocalStorage(THEME_STORAGE_KEY);
  if (stored && VALID_BASE_THEME_IDS.has(stored)) return stored as BaseTheme;
  return 'scanner-darkly';
}

/**
 * Returns the mode that was last stored in `localStorage`. Falls back to
 * the OS preference (`prefers-color-scheme`) for first-time visitors,
 * defaulting to `'dark'` when the media query is not available.
 */
function getInitialMode(): Mode {
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

  // useLayoutEffect ensures data-theme/data-mode are set before any child
  // useEffect reads getComputedStyle (e.g. useThemeOverrides).
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = baseTheme;
    document.documentElement.dataset.mode = mode;
  }, [baseTheme, mode]);

  const setBaseTheme = useCallback((theme: BaseTheme) => {
    setBaseThemeState(theme);
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    window.localStorage.setItem(THEME_UPDATED_AT_KEY, Date.now().toString());
  }, []);

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

  const value = useMemo(
    () => ({
      applyServerMode,
      applyServerTheme,
      baseTheme,
      mode,
      setBaseTheme,
      setMode,
      toggleMode,
    }),
    [
      applyServerMode,
      applyServerTheme,
      baseTheme,
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
