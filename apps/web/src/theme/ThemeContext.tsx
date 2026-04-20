import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

export type BaseTheme =
  | 'scanner-darkly'
  | 'before-sunrise'
  | 'before-sunset'
  | 'before-midnight'
  | 'boyhood'
  | 'dazed-and-confused'
  | 'hit-man'
  | 'school-of-rock';

export type Mode = 'light' | 'dark';

export const THEMES: Array<{ id: BaseTheme; label: string; accent: string }> = [
  { id: 'scanner-darkly',     label: 'A Scanner Darkly',   accent: '#a3e635' },
  { id: 'before-sunrise',     label: 'Before Sunrise',     accent: '#b45309' },
  { id: 'before-sunset',      label: 'Before Sunset',      accent: '#d97706' },
  { id: 'before-midnight',    label: 'Before Midnight',    accent: '#f59e0b' },
  { id: 'boyhood',            label: 'Boyhood',            accent: '#86efac' },
  { id: 'dazed-and-confused', label: 'Dazed and Confused', accent: '#dc2626' },
  { id: 'hit-man',            label: 'Hit Man',            accent: '#f59e0b' },
  { id: 'school-of-rock',     label: 'School of Rock',     accent: '#b91c1c' },
];

const VALID_BASE_THEME_IDS = new Set<string>(THEMES.map((t) => t.id));

function readLocalStorage(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

interface ThemeContextValue {
  baseTheme: BaseTheme;
  mode: Mode;
  setBaseTheme: (theme: BaseTheme) => void;
  setMode: (mode: Mode) => void;
  toggleMode: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const THEME_STORAGE_KEY = 'linklater_theme';
const MODE_STORAGE_KEY = 'linklater_mode';

function getInitialBaseTheme(): BaseTheme {
  const stored = readLocalStorage(THEME_STORAGE_KEY);
  if (stored && VALID_BASE_THEME_IDS.has(stored)) return stored as BaseTheme;
  return 'scanner-darkly';
}

function getInitialMode(): Mode {
  const stored = readLocalStorage(MODE_STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: light)').matches) {
    return 'light';
  }
  return 'dark';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [baseTheme, setBaseThemeState] = useState<BaseTheme>(getInitialBaseTheme);
  const [mode, setModeState] = useState<Mode>(getInitialMode);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.dataset.theme = baseTheme;
    document.documentElement.dataset.mode = mode;
    window.localStorage.setItem(THEME_STORAGE_KEY, baseTheme);
    window.localStorage.setItem(MODE_STORAGE_KEY, mode);
  }, [baseTheme, mode]);

  const setBaseTheme = (t: BaseTheme) => {
    setBaseThemeState(t);
  };

  const setMode = (m: Mode) => {
    setModeState(m);
  };

  const toggleMode = () => {
    setModeState((current) => (current === 'light' ? 'dark' : 'light'));
  };

  return (
    <ThemeContext.Provider value={{ baseTheme, mode, setBaseTheme, setMode, toggleMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}
