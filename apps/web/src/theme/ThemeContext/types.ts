import type { BaseTheme, Mode } from '../constants';
import type { CustomTheme } from '../customTheme';

/**
 * Theme state and actions, reached through `useTheme`.
 *
 * Every setter here persists with a timestamp, and every `applyServer`
 * counterpart drops a server value that lost to a newer local one. Both
 * halves of that race live in `theme/storage.ts`.
 */
export interface ThemeContextValue {
  baseTheme: BaseTheme;
  mode: Mode;
  /** Moving off the CVD base theme also turns CVD mode off. */
  setBaseTheme: (theme: BaseTheme) => void;
  /** The theme being previewed, or `null` when none is. */
  previewTheme: BaseTheme | null;
  /**
   * Paints a theme without committing it, so consumers keep reading the
   * real selection. Pass `null` to revert.
   */
  setPreviewTheme: (theme: BaseTheme | null) => void;
  setMode: (mode: Mode) => void;
  toggleMode: () => void;
  applyServerTheme: (theme: BaseTheme) => void;
  /** Ignored while this device is following its own OS color scheme. */
  applyServerMode: (mode: Mode) => void;
  /** Returns the resolved theme for the caller to send to the server. */
  enableCvdMode: () => BaseTheme;
  /** Returns the restored theme for the caller to send to the server. */
  disableCvdMode: () => BaseTheme;
  isCvdMode: boolean;
  enableDyslexicFont: () => void;
  disableDyslexicFont: () => void;
  isDyslexicFont: boolean;
  /** Inlined onto the document root while the custom theme is active. */
  customTheme: CustomTheme | null;
  setCustomTheme: (customTheme: CustomTheme) => void;
  applyServerCustomTheme: (customTheme: CustomTheme | null) => void;
  /** Opt-in for the picker menus only; the editor always reaches it. */
  customThemeEnabled: boolean;
  setCustomThemeEnabled: (enabled: boolean) => void;
  applyServerCustomThemeEnabled: (enabled: boolean) => void;
}
