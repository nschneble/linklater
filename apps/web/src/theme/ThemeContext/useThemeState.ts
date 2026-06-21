import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  CVD_BASE_THEME,
  VALID_BASE_THEME_IDS,
  type BaseTheme,
  type Mode,
} from '../constants';
import {
  CUSTOM_TOKEN_KEYS,
  readStoredCustomTheme,
  tokensForMode,
} from '../customTheme';
import { getInitialBaseTheme, getInitialMode } from '../initial';
import {
  CUSTOM_THEME_STORAGE_KEY,
  CUSTOM_THEME_UPDATED_AT_KEY,
  CVD_MODE_KEY,
  CVD_UPDATED_AT_KEY,
  MODE_STORAGE_KEY,
  MODE_UPDATED_AT_KEY,
  PRE_CVD_THEME_KEY,
  RECENT_LOCAL_CHANGE_MS,
  THEME_STORAGE_KEY,
  THEME_UPDATED_AT_KEY,
  readLocalStorage,
} from '../storage';
import type { CustomTheme } from '../customTheme';
import type { ThemeContextValue } from './types';

/**
 * Encapsulates all theme state, layout effects, and action handlers.
 * Consumed by `ThemeProvider`, which passes the returned value into context.
 */
export function useThemeState(): ThemeContextValue {
  const [baseTheme, setBaseThemeState] =
    useState<BaseTheme>(getInitialBaseTheme);
  const [mode, setModeState] = useState<Mode>(getInitialMode);
  const [isCvdMode, setIsCvdMode] = useState<boolean>(
    () => readLocalStorage(CVD_MODE_KEY) === 'on',
  );
  const [customTheme, setCustomThemeState] = useState<CustomTheme | null>(
    readStoredCustomTheme,
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

  // Injects the user's stored Custom theme tokens for the current mode as
  // inline CSS custom properties on the document root while the `'custom'`
  // theme is active. Unlike the film themes (whose palettes live in CSS files
  // keyed off `[data-theme]`), the Custom palette is per-user data, so it has
  // to be applied imperatively.
  //
  // When the Custom theme is active but no tokens are saved for the current
  // mode, nothing is injected and the page falls back to the synthetic
  // `:root` defaults already in bundles.css. When switching away from Custom
  // (or to the other mode), the cleanup removes every previously injected
  // property so custom values can't leak onto another theme.
  useLayoutEffect(() => {
    if (baseTheme !== 'custom') return;
    const root = document.documentElement;
    const tokens = tokensForMode(customTheme, mode);
    for (const variable of CUSTOM_TOKEN_KEYS) {
      const value = tokens[variable];
      if (value) {
        root.style.setProperty(variable, value);
      } else {
        root.style.removeProperty(variable);
      }
    }
    return () => {
      for (const variable of CUSTOM_TOKEN_KEYS) {
        root.style.removeProperty(variable);
      }
    };
  }, [baseTheme, mode, customTheme]);

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
        setIsCvdMode(false);
        window.localStorage.setItem(CVD_MODE_KEY, 'off');
        window.localStorage.removeItem(PRE_CVD_THEME_KEY);
      }
    },
    [isCvdMode],
  );

  // Animates the page-wide background/color/border swap when light/dark mode
  // toggles. Without this, mode swaps use the default 80ms transition, which
  // feels abrupt next to the 150ms/600ms transitions used by the theme picker.
  const modeTransitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const applyModeTransition = useCallback(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.style.setProperty('--theme-transition-duration', '300ms');
    root.style.setProperty('--theme-transition-easing', 'ease-out');
    if (modeTransitionTimeoutRef.current) {
      clearTimeout(modeTransitionTimeoutRef.current);
    }
    modeTransitionTimeoutRef.current = setTimeout(() => {
      root.style.removeProperty('--theme-transition-duration');
      root.style.removeProperty('--theme-transition-easing');
      modeTransitionTimeoutRef.current = null;
    }, 350);
  }, []);

  useEffect(() => {
    return () => {
      if (modeTransitionTimeoutRef.current) {
        clearTimeout(modeTransitionTimeoutRef.current);
      }
    };
  }, []);

  const setMode = useCallback(
    (newMode: Mode) => {
      applyModeTransition();
      setModeState(newMode);
      window.localStorage.setItem(MODE_STORAGE_KEY, newMode);
      window.localStorage.setItem(MODE_UPDATED_AT_KEY, Date.now().toString());
    },
    [applyModeTransition],
  );

  const toggleMode = useCallback(() => {
    applyModeTransition();
    setModeState((current) => {
      const next = current === 'light' ? 'dark' : 'light';
      window.localStorage.setItem(MODE_STORAGE_KEY, next);
      window.localStorage.setItem(MODE_UPDATED_AT_KEY, Date.now().toString());
      return next;
    });
  }, [applyModeTransition]);

  const applyServerTheme = useCallback((theme: BaseTheme) => {
    const updatedAt = parseInt(
      readLocalStorage(THEME_UPDATED_AT_KEY) ?? '0',
      10,
    );
    if (Date.now() - updatedAt < RECENT_LOCAL_CHANGE_MS) return;
    setBaseThemeState(theme);
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, []);

  const setCustomTheme = useCallback((nextCustomTheme: CustomTheme) => {
    setCustomThemeState(nextCustomTheme);
    window.localStorage.setItem(
      CUSTOM_THEME_STORAGE_KEY,
      JSON.stringify(nextCustomTheme),
    );
    window.localStorage.setItem(
      CUSTOM_THEME_UPDATED_AT_KEY,
      Date.now().toString(),
    );
  }, []);

  const applyServerCustomTheme = useCallback(
    (serverCustomTheme: CustomTheme | null) => {
      const updatedAt = parseInt(
        readLocalStorage(CUSTOM_THEME_UPDATED_AT_KEY) ?? '0',
        10,
      );
      if (Date.now() - updatedAt < RECENT_LOCAL_CHANGE_MS) return;
      setCustomThemeState(serverCustomTheme);
      if (serverCustomTheme) {
        window.localStorage.setItem(
          CUSTOM_THEME_STORAGE_KEY,
          JSON.stringify(serverCustomTheme),
        );
      } else {
        window.localStorage.removeItem(CUSTOM_THEME_STORAGE_KEY);
      }
    },
    [],
  );

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
    setIsCvdMode(true);
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
    setIsCvdMode(false);
    return previousTheme;
  }, []);

  return useMemo(
    () => ({
      applyServerCustomTheme,
      applyServerMode,
      applyServerTheme,
      baseTheme,
      customTheme,
      disableCvdMode,
      enableCvdMode,
      isCvdMode,
      mode,
      setBaseTheme,
      setCustomTheme,
      setMode,
      toggleMode,
    }),
    [
      applyServerCustomTheme,
      applyServerMode,
      applyServerTheme,
      baseTheme,
      customTheme,
      disableCvdMode,
      enableCvdMode,
      isCvdMode,
      mode,
      setBaseTheme,
      setCustomTheme,
      setMode,
      toggleMode,
    ],
  );
}
