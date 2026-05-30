import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';

import {
  CVD_BASE_THEME,
  VALID_BASE_THEME_IDS,
  type BaseTheme,
  type Mode,
} from '../constants';
import { getInitialBaseTheme, getInitialMode } from '../initial';
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
} from '../storage';
import type { ThemeContextValue } from './types';

/**
 * Encapsulates all theme state, layout effects, and action handlers.
 * Consumed by `ThemeProvider`, which passes the returned value into context.
 */
export function useThemeState(): ThemeContextValue {
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

  return useMemo(
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
}
