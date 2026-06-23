import type { BaseTheme, Mode } from '../constants';
import type { CustomTheme } from '../customTheme';

/**
 * The shape of the value provided by `ThemeContext`. All theme-related
 * state and actions are accessed through this interface via `useTheme`.
 */
export interface ThemeContextValue {
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
  /**
   * The user's editable Custom theme (`{ dark, light }` token maps), or
   * `null` when the user has never saved one. Its tokens are injected onto
   * `document.documentElement` as inline CSS custom properties while the
   * `'custom'` base theme is active.
   */
  customTheme: CustomTheme | null;
  /**
   * Sets the Custom theme from a user action (the Theme Editor's Save in
   * wave 3). Persists to `localStorage` with a timestamp so a subsequent
   * server sync cannot overwrite a very recent change.
   */
  setCustomTheme: (customTheme: CustomTheme) => void;
  /**
   * Applies the server-stored Custom theme. Skips the update if the user
   * saved a Custom theme locally within the last 30 seconds, mirroring the
   * race-condition guard used by `applyServerTheme`.
   */
  applyServerCustomTheme: (customTheme: CustomTheme | null) => void;
  /**
   * Whether the user has opted the Custom theme into the theme picker. The
   * Custom theme is always reachable from the Theme Editor; this flag only
   * controls whether the picker menus list it.
   */
  customThemeEnabled: boolean;
  /**
   * Sets the Custom-theme picker opt-in from a user action (the Theme
   * Editor's toggle). Persists to `localStorage` with a timestamp so a
   * subsequent server sync cannot overwrite a very recent change.
   */
  setCustomThemeEnabled: (enabled: boolean) => void;
  /**
   * Applies the server-stored Custom-theme picker opt-in. Skips the update
   * if the user toggled it locally within the last 30 seconds.
   */
  applyServerCustomThemeEnabled: (enabled: boolean) => void;
}
