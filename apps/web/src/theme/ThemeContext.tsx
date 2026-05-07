import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

/**
 * All valid theme identifiers, each mapping to a Richard Linklater film.
 * Adding a new theme requires updating this union, the `THEMES` array below,
 * `VALID_THEMES` in `apps/api/src/users/users.constants.ts`, and the matching
 * CSS variable file in `apps/web/src/theme/styles/`.
 */
export type BaseTheme =
  | 'before-midnight'
  | 'before-sunrise'
  | 'before-sunset'
  | 'boyhood'
  | 'dazed-and-confused'
  | 'hit-man'
  | 'scanner-darkly'
  | 'school-of-rock';

/** The two color modes. */
export type Mode = 'light' | 'dark';

/**
 * All available themes with their display label and accent color swatch.
 * The accent color is used purely for the color dot shown in the theme submenu
 * — it does not need to be pixel-perfect; it just needs to be recognizable.
 */
export const THEMES: Array<{ id: BaseTheme; label: string; accent: string }> = [
  { id: 'scanner-darkly', label: 'A Scanner Darkly', accent: '#a3e635' },
  { id: 'before-sunrise', label: 'Before Sunrise', accent: '#b45309' },
  { id: 'before-sunset', label: 'Before Sunset', accent: '#d97706' },
  { id: 'before-midnight', label: 'Before Midnight', accent: '#f59e0b' },
  { id: 'boyhood', label: 'Boyhood', accent: '#86efac' },
  { id: 'dazed-and-confused', label: 'Dazed and Confused', accent: '#dc2626' },
  { id: 'hit-man', label: 'Hit Man', accent: '#f59e0b' },
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
 * The shape of the value provided by `ThemeContext`. All theme-related state
 * and actions are accessed through this interface via `useTheme`.
 */
interface ThemeContextValue {
  /** The currently active base theme. */
  baseTheme: BaseTheme;
  /** The current color mode. */
  mode: Mode;
  /** Sets the base theme. Also persists to `localStorage` and updates the `data-theme` attribute. */
  setBaseTheme: (theme: BaseTheme) => void;
  /** Sets the color mode. Also persists to `localStorage` and updates the `data-mode` attribute. */
  setMode: (mode: Mode) => void;
  /** Toggles between `'light'` and `'dark'`. */
  toggleMode: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

/** `localStorage` key for persisting the selected theme across sessions. */
const THEME_STORAGE_KEY = 'linklater_theme';
/** `localStorage` key for persisting the selected color mode across sessions. */
const MODE_STORAGE_KEY = 'linklater_mode';

/**
 * Returns the theme that was last stored in `localStorage`, falling back to
 * `'scanner-darkly'` for first-time visitors.
 */
function getInitialBaseTheme(): BaseTheme {
  const stored = readLocalStorage(THEME_STORAGE_KEY);
  if (stored && VALID_BASE_THEME_IDS.has(stored)) return stored as BaseTheme;
  return 'scanner-darkly';
}

/**
 * Returns the mode that was last stored in `localStorage`. Falls back to the
 * OS preference (`prefers-color-scheme`) for first-time visitors, defaulting
 * to `'dark'` when the media query is not available.
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
 * Both values are persisted to `localStorage` so they survive page reloads.
 * Server-stored preferences (from `GET /auth/me`) are synced into this
 * context by `App.tsx` after login.
 *
 * @param children - The subtree that should have access to theme state.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [baseTheme, setBaseThemeState] =
    useState<BaseTheme>(getInitialBaseTheme);
  const [mode, setModeState] = useState<Mode>(getInitialMode);

  // Apply theme and mode to the DOM and persist to localStorage whenever either changes.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.dataset.theme = baseTheme;
    document.documentElement.dataset.mode = mode;
    window.localStorage.setItem(THEME_STORAGE_KEY, baseTheme);
    window.localStorage.setItem(MODE_STORAGE_KEY, mode);
  }, [baseTheme, mode]);

  const setBaseTheme = useCallback((theme: BaseTheme) => {
    setBaseThemeState(theme);
  }, []);

  const setMode = useCallback((mode: Mode) => {
    setModeState(mode);
  }, []);

  const toggleMode = useCallback(() => {
    setModeState((current) => (current === 'light' ? 'dark' : 'light'));
  }, []);

  const value = useMemo(
    () => ({ baseTheme, mode, setBaseTheme, setMode, toggleMode }),
    [baseTheme, mode, setBaseTheme, setMode, toggleMode],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

/**
 * Provides access to theme state and actions from any component within
 * the `ThemeProvider` tree.
 *
 * @throws {Error} When called outside of a `ThemeProvider`.
 */
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');

  return context;
}
