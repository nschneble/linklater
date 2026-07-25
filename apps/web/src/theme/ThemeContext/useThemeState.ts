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
  applyCustomThemeTokens,
  clearCustomThemeTokens,
  readStoredCustomTheme,
} from '../customTheme';
import { getInitialBaseTheme, getInitialMode } from '../initial';
import {
  CUSTOM_THEME_ENABLED_KEY,
  CUSTOM_THEME_ENABLED_UPDATED_AT_KEY,
  CUSTOM_THEME_STORAGE_KEY,
  CUSTOM_THEME_UPDATED_AT_KEY,
  CVD_MODE_KEY,
  CVD_UPDATED_AT_KEY,
  DYSLEXIC_FONT_KEY,
  DYSLEXIC_FONT_UPDATED_AT_KEY,
  MODE_STORAGE_KEY,
  MODE_UPDATED_AT_KEY,
  PRE_CVD_THEME_KEY,
  THEME_STORAGE_KEY,
  THEME_UPDATED_AT_KEY,
  hasRecentLocalChange,
  persistWithTimestamp,
  readLocalStorage,
} from '../storage';
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
  // Transient, non-persisting preview overlay. When set, the page PAINTS in
  // this theme (data-theme + custom-token injection) while the committed
  // `baseTheme` is left untouched, so nothing downstream of the real selection
  // changes. Used by the editor's copy-palette picker to peek at a film theme.
  const [previewTheme, setPreviewTheme] = useState<BaseTheme | null>(null);

  // The theme actually PAINTED on the document (`data-theme`). Unauthenticated
  // visitors always get the off-book `branding` chrome — their stored film
  // palettes and the per-user `custom` palette are only theirs to show once a
  // session exists — so branding wins HERE, before the `=== 'custom'`
  // token-injection gate below. `branding !== 'custom'`, so no tokens are
  // injected and no stale/hostile stored custom palette can plant a
  // low-contrast focus ring on the login controls. The raw `baseTheme`
  // selection is left untouched (and restores the instant the session
  // confirms), so nothing here persists.
  //
  // When authenticated, a transient preview wins over the committed selection
  // (the editor's copy-palette picker) but is likewise never persisted. There
  // is no unauthenticated preview path: the editor is the only caller and is
  // authenticated-only, and branding short-circuits every unauth paint anyway.
  const paintedTheme: PaintedTheme = !isAuthenticated
    ? BRANDING_THEME_ID
    : (previewTheme ?? baseTheme);

  // Ref to always have the current baseTheme available in callbacks
  // without them needing to be recreated on every theme change.
  const baseThemeRef = useRef<BaseTheme>(baseTheme);
  useLayoutEffect(() => {
    baseThemeRef.current = baseTheme;
  }, [baseTheme]);

  // useLayoutEffect ensures data-theme/data-mode are set before any child
  // useEffect reads getComputedStyle (e.g. useThemeOverrides).
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = paintedTheme;
    document.documentElement.dataset.mode = mode;
  }, [paintedTheme, mode]);

  // Injects the user's stored Custom theme tokens for the current mode as
  // inline CSS custom properties on the document root while the `'custom'`
  // theme is active. Unlike the film themes (whose palettes live in CSS files
  // keyed off `[data-theme]`), the Custom palette is per-user data, so it has
  // to be applied imperatively.
  //
  // When the Custom theme is active but no tokens are saved for a slot, that
  // slot falls back to the off-book `branding` palette for the current mode
  // (BRANDING_DEFAULTS dark / BRANDING_DEFAULTS_LIGHT light) so a fresh Custom
  // theme "defaults to branding" in both modes. Only the allowlisted
  // CUSTOM_TOKEN_KEYS are ever written, so the branding fallback stays inside
  // the same trust boundary as user data — never a trusted bypass. When
  // switching away from Custom (or to the other mode), the cleanup removes
  // every previously injected property so the values can't leak onto another
  // theme.
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

  // Toggles the `data-dyslexic-font="on"` attribute the OpenDyslexic override
  // block in index.css keys off. `dataset.dyslexicFont` writes the kebab-cased
  // `data-dyslexic-font` attribute, matching that block's `[data-dyslexic-font
  // ='on']` selector. Unlike CVD mode this is a pure attribute toggle: it does
  // not switch the active color theme.
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
      persistWithTimestamp(THEME_STORAGE_KEY, theme, THEME_UPDATED_AT_KEY);

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
      persistWithTimestamp(MODE_STORAGE_KEY, newMode, MODE_UPDATED_AT_KEY);
    },
    [applyModeTransition],
  );

  const toggleMode = useCallback(() => {
    applyModeTransition();
    setModeState((current) => {
      const next = current === 'light' ? 'dark' : 'light';
      persistWithTimestamp(MODE_STORAGE_KEY, next, MODE_UPDATED_AT_KEY);
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
    persistWithTimestamp(
      CUSTOM_THEME_STORAGE_KEY,
      JSON.stringify(nextCustomTheme),
      CUSTOM_THEME_UPDATED_AT_KEY,
    );
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
    persistWithTimestamp(
      CUSTOM_THEME_ENABLED_KEY,
      enabled ? 'on' : 'off',
      CUSTOM_THEME_ENABLED_UPDATED_AT_KEY,
    );
  }, []);

  const applyServerCustomThemeEnabled = useCallback((enabled: boolean) => {
    if (hasRecentLocalChange(CUSTOM_THEME_ENABLED_UPDATED_AT_KEY)) return;
    setCustomThemeEnabledState(enabled);
    window.localStorage.setItem(
      CUSTOM_THEME_ENABLED_KEY,
      enabled ? 'on' : 'off',
    );
  }, []);

  const applyServerMode = useCallback((serverMode: Mode) => {
    if (hasRecentLocalChange(MODE_UPDATED_AT_KEY)) return;
    setModeState(serverMode);
    window.localStorage.setItem(MODE_STORAGE_KEY, serverMode);
  }, []);

  const enableCvdMode = useCallback((): BaseTheme => {
    const current = baseThemeRef.current;
    if (current !== CVD_BASE_THEME) {
      window.localStorage.setItem(PRE_CVD_THEME_KEY, current);
    }
    setBaseThemeState(CVD_BASE_THEME);
    persistWithTimestamp(
      THEME_STORAGE_KEY,
      CVD_BASE_THEME,
      THEME_UPDATED_AT_KEY,
    );
    persistWithTimestamp(CVD_MODE_KEY, 'on', CVD_UPDATED_AT_KEY);
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
    persistWithTimestamp(
      THEME_STORAGE_KEY,
      previousTheme,
      THEME_UPDATED_AT_KEY,
    );
    persistWithTimestamp(CVD_MODE_KEY, 'off', CVD_UPDATED_AT_KEY);
    window.localStorage.removeItem(PRE_CVD_THEME_KEY);
    setIsCvdMode(false);
    return previousTheme;
  }, []);

  // Enabling/disabling the dyslexic font is a self-contained attribute toggle:
  // it writes only its own `localStorage` key + timestamp (the App.tsx race
  // guard reads the timestamp) and never touches the active theme, so (unlike
  // `enableCvdMode`/`disableCvdMode`) it returns nothing for callers to fold
  // into a server PATCH's `theme` field.
  const enableDyslexicFont = useCallback(() => {
    setIsDyslexicFont(true);
    persistWithTimestamp(DYSLEXIC_FONT_KEY, 'on', DYSLEXIC_FONT_UPDATED_AT_KEY);
  }, []);

  const disableDyslexicFont = useCallback(() => {
    setIsDyslexicFont(false);
    persistWithTimestamp(
      DYSLEXIC_FONT_KEY,
      'off',
      DYSLEXIC_FONT_UPDATED_AT_KEY,
    );
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
