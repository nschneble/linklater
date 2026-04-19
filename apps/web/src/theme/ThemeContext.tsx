import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

export type Theme =
  | 'light'
  | 'dark'
  | 'scanner-darkly'
  | 'before-sunrise'
  | 'before-sunset'
  | 'before-midnight'
  | 'boyhood'
  | 'dazed-and-confused'
  | 'hit-man'
  | 'school-of-rock';

export const THEMES: Array<{ id: Theme; label: string; accent: string }> = [
  { id: 'light',              label: 'Light',              accent: '#34d399' },
  { id: 'dark',               label: 'Dark',               accent: '#34d399' },
  { id: 'scanner-darkly',     label: 'A Scanner Darkly',   accent: '#a3e635' },
  { id: 'before-sunrise',     label: 'Before Sunrise',     accent: '#b45309' },
  { id: 'before-sunset',      label: 'Before Sunset',      accent: '#d97706' },
  { id: 'before-midnight',    label: 'Before Midnight',    accent: '#f59e0b' },
  { id: 'boyhood',            label: 'Boyhood',            accent: '#86efac' },
  { id: 'dazed-and-confused', label: 'Dazed and Confused', accent: '#dc2626' },
  { id: 'hit-man',            label: 'Hit Man',            accent: '#f59e0b' },
  { id: 'school-of-rock',     label: 'School of Rock',     accent: '#b91c1c' },
];

const VALID_THEME_IDS = new Set<string>(THEMES.map((t) => t.id));

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const STORAGE_KEY = 'linklater_theme';

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';

  const hasLocalStorage =
    typeof window.localStorage !== 'undefined' &&
    typeof window.localStorage.getItem === 'function';

  if (hasLocalStorage) {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && VALID_THEME_IDS.has(stored)) return stored as Theme;
  }

  if (window.matchMedia?.('(prefers-color-scheme: light)').matches) {
    return 'light';
  }
  return 'dark';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const setTheme = (t: Theme) => {
    setThemeState(t);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
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
