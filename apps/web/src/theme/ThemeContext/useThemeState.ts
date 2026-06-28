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
 * The theme shown to unauthenticated visitors whose stored selection is the
 * per-user `custom` theme. Its palette is contract-validated in
 * `bundles.contrast.test.ts` (both modes), unlike the user-authored custom
 * palette, so it is safe to paint behind the login/signup screens.
 */
const UNAUTHENTICATED_FALLBACK_THEME: BaseTheme = 'scanner-darkly';

/**
 * Encapsulates all theme state, layout effects, and action handlers.
 * Consumed by `ThemeProvider`, which passes the returned value into context.
 *
 * @param isAuthenticated - Whether a user session exists. The `custom` theme
 *   renders a per-user palette injected from `localStorage`; for an
 *   unauthenticated visitor (logged out, or a fresh/DB-reset browser holding
 *   stale storage) that palette is not theirs to show and carries no contrast
 *   contract, so it is replaced by `UNAUTHENTICATED_FALLBACK_THEME` on the
 *   auth screens. `localStorage` is left untouched, so the custom selection
 *   restores automatically once the server sync confirms it after login.
 *   Defaults to `true` so direct hook tests and bare `ThemeProvider` mounts
 *   keep their pre-gate behavior.
 */
export function useThemeState(isAuthenticated = true): ThemeContextValue {
  const [baseTheme, setBaseThemeState] =
    useState<BaseTheme>(getInitialBaseTheme);
  const [mode, setModeState] = useState<Mode>(getInitialMode);
  const [isCvdMode, setIsCvdMode] = useState<boolean>(
    () => readLocalStorage(CVD_MODE_KEY) === 'on',
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

  // The theme actually painted. Diverges from the stored `baseTheme` only when
  // an unauthenticated visitor's stored selection is `custom`, which is gated
  // to a validated fallback (see the `isAuthenticated` param docs). Everything
  // that renders the page — the `data-theme` attribute, the custom-token
  // injection, the value handed to consumers — keys off this, while the
  // setters and CVD logic keep operating on the raw `baseTheme` so the user's
  // real selection survives untouched until login restores it.
  const effectiveBaseTheme: BaseTheme =
    !isAuthenticated && baseTheme === 'custom'
      ? UNAUTHENTICATED_FALLBACK_THEME
      : baseTheme;

  // The theme actually PAINTED on the document. A transient preview wins over
  // the committed selection but is never persisted, so the data-theme + custom
  // tokens follow it while consumers keep reading the real `effectiveBaseTheme`.
  // A preview never bypasses the unauthenticated custom-theme gate: an unauth
  // visitor can't be painted in the per-user custom palette via a preview
  // either (the editor is the only caller and is authenticated-only, so this is
  // a belt-and-suspenders guard).
  const previewIsGated = !isAuthenticated && previewTheme === 'custom';
  const paintedTheme: BaseTheme =
    previewTheme && !previewIsGated ? previewTheme : effectiveBaseTheme;

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

  const setCustomThemeEnabled = useCallback((enabled: boolean) => {
    setCustomThemeEnabledState(enabled);
    window.localStorage.setItem(
      CUSTOM_THEME_ENABLED_KEY,
      enabled ? 'on' : 'off',
    );
    window.localStorage.setItem(
      CUSTOM_THEME_ENABLED_UPDATED_AT_KEY,
      Date.now().toString(),
    );
  }, []);

  const applyServerCustomThemeEnabled = useCallback((enabled: boolean) => {
    const updatedAt = parseInt(
      readLocalStorage(CUSTOM_THEME_ENABLED_UPDATED_AT_KEY) ?? '0',
      10,
    );
    if (Date.now() - updatedAt < RECENT_LOCAL_CHANGE_MS) return;
    setCustomThemeEnabledState(enabled);
    window.localStorage.setItem(
      CUSTOM_THEME_ENABLED_KEY,
      enabled ? 'on' : 'off',
    );
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
      applyServerCustomThemeEnabled,
      applyServerMode,
      applyServerTheme,
      baseTheme: effectiveBaseTheme,
      customTheme,
      customThemeEnabled,
      disableCvdMode,
      enableCvdMode,
      isCvdMode,
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
      effectiveBaseTheme,
      customTheme,
      customThemeEnabled,
      disableCvdMode,
      enableCvdMode,
      isCvdMode,
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
