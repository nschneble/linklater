import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  applyCustomThemeTokens,
  clearCustomThemeTokens,
  readStoredCustomTheme,
} from '../customTheme';
import {
  CUSTOM_THEME_ENABLED_KEY,
  CUSTOM_THEME_ENABLED_UPDATED_AT_KEY,
  CUSTOM_THEME_STORAGE_KEY,
  CUSTOM_THEME_UPDATED_AT_KEY,
  CVD_MODE_KEY,
  CVD_UPDATED_AT_KEY,
  DYSLEXIC_FONT_KEY,
  DYSLEXIC_FONT_UPDATED_AT_KEY,
  hasRecentLocalChange,
  MODE_STORAGE_KEY,
  MODE_UPDATED_AT_KEY,
  persistWithTimestamp,
  PRE_CVD_THEME_KEY,
  readLocalStorage,
  THEME_STORAGE_KEY,
  THEME_UPDATED_AT_KEY,
} from '../storage';
import {
  CVD_BASE_THEME,
  VALID_BASE_THEME_IDS,
  type BaseTheme,
  type Mode,
} from '../constants';
import { getInitialBaseTheme, getInitialMode } from '../initial';
import { isFollowingSystemMode, useSystemModeSync } from '../systemMode';
import type { CustomTheme } from '../customTheme';
import type { ThemeContextValue } from './types';

/**
 * The off-book `branding` chrome id, painted (as `data-theme='branding'`) for
 * every unauthenticated visitor regardless of their stored film/custom
 * selection, so the marketing chrome — never a stale localStorage theme —
 * backs the logged-out auth surfaces (login, signup, password reset, MFA,
 * verify-login, account-deletion confirmation, extension authorize).
 *
 * It is deliberately NOT a `BaseTheme`: adding it to the `BaseTheme` union,
 * `THEMES`, or `VALID_BASE_THEME_IDS` would make it user-selectable and break
 * its invisibility contract (THEMES.md §7, "Do NOT 'fix' branding by
 * registering it"). It is valid ONLY as a painted `data-theme` attribute value
 * — never as a stored or selected theme — so it lives here as a standalone
 * literal that widens only `PaintedTheme`, not the `BaseTheme`-typed selection
 * handed to consumers.
 */
const BRANDING_THEME_ID = 'branding';

/**
 * A theme id valid as a painted `data-theme` value: any selectable `BaseTheme`,
 * plus the off-book `branding` chrome forced onto unauthenticated visitors.
 * Only the painted attribute widens to include branding; the committed
 * selection and the value reported to consumers stay `BaseTheme`.
 */
type PaintedTheme = BaseTheme | typeof BRANDING_THEME_ID;

/**
 * Encapsulates all theme state, layout effects, and action handlers.
 * Consumed by `ThemeProvider`, which passes the returned value into context.
 *
 * @param isAuthenticated - Whether a user session exists. Film themes and the
 *   per-user `custom` theme are only theirs to show once logged in, so an
 *   unauthenticated visitor (logged out, or a fresh/DB-reset browser holding
 *   stale storage) is always painted in the off-book `branding` chrome
 *   (`BRANDING_THEME_ID`) on the auth surfaces — never their stored film theme
 *   or the runtime-injected custom palette. `localStorage` is left untouched,
 *   so the stored selection restores automatically once the server sync
 *   confirms it after login. Defaults to `true` so direct hook tests and bare
 *   `ThemeProvider` mounts keep their authenticated painting behavior.
 */
export function useThemeState(isAuthenticated = true): ThemeContextValue {
  const [baseTheme, setBaseThemeState] =
    useState<BaseTheme>(getInitialBaseTheme);
  const [mode, setModeState] = useState<Mode>(getInitialMode);
  const [isCvdMode, setIsCvdMode] = useState<boolean>(
    () => readLocalStorage(CVD_MODE_KEY) === 'on',
  );
  const [isDyslexicFont, setIsDyslexicFont] = useState<boolean>(
    () => readLocalStorage(DYSLEXIC_FONT_KEY) === 'on',
  );
  const [customTheme, setCustomThemeState] = useState<CustomTheme | null>(
    readStoredCustomTheme,
  );
  const [customThemeEnabled, setCustomThemeEnabledState] = useState<boolean>(
    () => readLocalStorage(CUSTOM_THEME_ENABLED_KEY) === 'on',
  );
  // transient preview paint; committed baseTheme untouched (editor peek)
  const [previewTheme, setPreviewTheme] = useState<BaseTheme | null>(null);

  // unauth paints branding, not 'custom', so no stored custom palette can taint the logged-out auth controls
  const paintedTheme: PaintedTheme = !isAuthenticated
    ? BRANDING_THEME_ID
    : (previewTheme ?? baseTheme);

  // keeps current baseTheme reachable in callbacks without recreating them
  const baseThemeRef = useRef<BaseTheme>(baseTheme);
  useLayoutEffect(() => {
    baseThemeRef.current = baseTheme;
  }, [baseTheme]);

  // set data-theme/mode before child effects call getComputedStyle
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = paintedTheme;
    document.documentElement.dataset.mode = mode;
  }, [paintedTheme, mode]);

  // per-user custom tokens injected imperatively; cleanup clears them on switch so they can't leak to another theme
  useLayoutEffect(() => {
    if (paintedTheme !== 'custom') return;
    const root = document.documentElement;
    applyCustomThemeTokens(root, customTheme, mode);
    return () => clearCustomThemeTokens(root);
  }, [paintedTheme, mode, customTheme]);

  useLayoutEffect(() => {
    if (isCvdMode) {
      document.documentElement.dataset.cvd = 'on';
    } else {
      delete document.documentElement.dataset.cvd;
    }
  }, [isCvdMode]);

  // dataset.dyslexicFont sets data-dyslexic-font, keyed off by the OpenDyslexic block in index.css
  useLayoutEffect(() => {
    if (isDyslexicFont) {
      document.documentElement.dataset.dyslexicFont = 'on';
    } else {
      delete document.documentElement.dataset.dyslexicFont;
    }
  }, [isDyslexicFont]);

  const setBaseTheme = useCallback(
    (theme: BaseTheme) => {
      setBaseThemeState(theme);
      persistWithTimestamp({
        valueKey: THEME_STORAGE_KEY,
        value: theme,
        updatedAtKey: THEME_UPDATED_AT_KEY,
      });

      // leaving Apollo with CVD on clears CVD so the two can't desync

      if (isCvdMode && theme !== CVD_BASE_THEME) {
        setIsCvdMode(false);
        window.localStorage.setItem(CVD_MODE_KEY, 'off');
        window.localStorage.removeItem(PRE_CVD_THEME_KEY);
      }
    },
    [isCvdMode],
  );

  // lengthens the mode-toggle swap so it isn't abrupt next to the picker
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
      persistWithTimestamp({
        valueKey: MODE_STORAGE_KEY,
        value: newMode,
        updatedAtKey: MODE_UPDATED_AT_KEY,
      });
    },
    [applyModeTransition],
  );

  const toggleMode = useCallback(() => {
    applyModeTransition();
    setModeState((current) => {
      const next = current === 'light' ? 'dark' : 'light';
      persistWithTimestamp({
        valueKey: MODE_STORAGE_KEY,
        value: next,
        updatedAtKey: MODE_UPDATED_AT_KEY,
      });
      return next;
    });
  }, [applyModeTransition]);

  const applyServerTheme = useCallback((theme: BaseTheme) => {
    if (hasRecentLocalChange(THEME_UPDATED_AT_KEY)) return;
    setBaseThemeState(theme);
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, []);

  const setCustomTheme = useCallback((nextCustomTheme: CustomTheme) => {
    setCustomThemeState(nextCustomTheme);
    persistWithTimestamp({
      valueKey: CUSTOM_THEME_STORAGE_KEY,
      value: JSON.stringify(nextCustomTheme),
      updatedAtKey: CUSTOM_THEME_UPDATED_AT_KEY,
    });
  }, []);

  const applyServerCustomTheme = useCallback(
    (serverCustomTheme: CustomTheme | null) => {
      if (hasRecentLocalChange(CUSTOM_THEME_UPDATED_AT_KEY)) return;
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

  const setCustomThemeEnabled = useCallback((enabled: boolean) => {
    setCustomThemeEnabledState(enabled);
    persistWithTimestamp({
      valueKey: CUSTOM_THEME_ENABLED_KEY,
      value: enabled ? 'on' : 'off',
      updatedAtKey: CUSTOM_THEME_ENABLED_UPDATED_AT_KEY,
    });
  }, []);

  const applyServerCustomThemeEnabled = useCallback((enabled: boolean) => {
    if (hasRecentLocalChange(CUSTOM_THEME_ENABLED_UPDATED_AT_KEY)) return;
    setCustomThemeEnabledState(enabled);
    window.localStorage.setItem(
      CUSTOM_THEME_ENABLED_KEY,
      enabled ? 'on' : 'off',
    );
  }, []);

  // per-device: a device following its own OS ignores the account's mode
  const applyServerMode = useCallback((serverMode: Mode) => {
    if (isFollowingSystemMode()) return;
    if (hasRecentLocalChange(MODE_UPDATED_AT_KEY)) return;
    setModeState(serverMode);
    window.localStorage.setItem(MODE_STORAGE_KEY, serverMode);
  }, []);

  const adoptSystemMode = useCallback(
    (systemMode: Mode) => {
      applyModeTransition();
      setModeState(systemMode);
      window.localStorage.setItem(MODE_STORAGE_KEY, systemMode);
    },
    [applyModeTransition],
  );
  useSystemModeSync(adoptSystemMode);

  const enableCvdMode = useCallback((): BaseTheme => {
    const current = baseThemeRef.current;
    if (current !== CVD_BASE_THEME) {
      window.localStorage.setItem(PRE_CVD_THEME_KEY, current);
    }
    setBaseThemeState(CVD_BASE_THEME);
    persistWithTimestamp({
      valueKey: THEME_STORAGE_KEY,
      value: CVD_BASE_THEME,
      updatedAtKey: THEME_UPDATED_AT_KEY,
    });
    persistWithTimestamp({
      valueKey: CVD_MODE_KEY,
      value: 'on',
      updatedAtKey: CVD_UPDATED_AT_KEY,
    });
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
    persistWithTimestamp({
      valueKey: THEME_STORAGE_KEY,
      value: previousTheme,
      updatedAtKey: THEME_UPDATED_AT_KEY,
    });
    persistWithTimestamp({
      valueKey: CVD_MODE_KEY,
      value: 'off',
      updatedAtKey: CVD_UPDATED_AT_KEY,
    });
    window.localStorage.removeItem(PRE_CVD_THEME_KEY);
    setIsCvdMode(false);
    return previousTheme;
  }, []);

  // self-contained: writes only its own localStorage key+timestamp, no theme change, so it returns nothing (unlike enableCvdMode)
  const enableDyslexicFont = useCallback(() => {
    setIsDyslexicFont(true);
    persistWithTimestamp({
      valueKey: DYSLEXIC_FONT_KEY,
      value: 'on',
      updatedAtKey: DYSLEXIC_FONT_UPDATED_AT_KEY,
    });
  }, []);

  const disableDyslexicFont = useCallback(() => {
    setIsDyslexicFont(false);
    persistWithTimestamp({
      valueKey: DYSLEXIC_FONT_KEY,
      value: 'off',
      updatedAtKey: DYSLEXIC_FONT_UPDATED_AT_KEY,
    });
  }, []);

  return useMemo(
    () => ({
      applyServerCustomTheme,
      applyServerCustomThemeEnabled,
      applyServerMode,
      applyServerTheme,
      baseTheme,
      customTheme,
      customThemeEnabled,
      disableCvdMode,
      disableDyslexicFont,
      enableCvdMode,
      enableDyslexicFont,
      isCvdMode,
      isDyslexicFont,
      mode,
      setBaseTheme,
      setCustomTheme,
      setCustomThemeEnabled,
      setMode,
      setPreviewTheme,
      toggleMode,
    }),
    [
      applyServerCustomTheme,
      applyServerCustomThemeEnabled,
      applyServerMode,
      applyServerTheme,
      baseTheme,
      customTheme,
      customThemeEnabled,
      disableCvdMode,
      disableDyslexicFont,
      enableCvdMode,
      enableDyslexicFont,
      isCvdMode,
      isDyslexicFont,
      mode,
      setBaseTheme,
      setCustomTheme,
      setCustomThemeEnabled,
      setMode,
      setPreviewTheme,
      toggleMode,
    ],
  );
}
