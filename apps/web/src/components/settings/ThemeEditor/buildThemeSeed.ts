import {
  isCustomThemeConfigured,
  type CustomTheme,
} from '../../../theme/customTheme';
import { readThemeTokens } from './themeProbe';
import type { BaseTheme, Mode } from '../../../theme/constants';

/**
 * The seed both engage paths assemble identically: the edited mode carries the
 * caller's edited tokens; the OTHER mode keeps its saved tokens (re-engage
 * after a revert) or is probed fresh off the current theme. The random palette
 * + a color edit only ever touch `editorMode`, so the other mode is preserved.
 */
export function buildThemeSeed(
  editedModeTokens: Record<string, string>,
  baseTheme: BaseTheme,
  customTheme: CustomTheme | null,
  editorMode: Mode,
): CustomTheme {
  const otherMode: Mode = editorMode === 'dark' ? 'light' : 'dark';
  const otherModeTokens = isCustomThemeConfigured(customTheme)
    ? { ...(customTheme?.[otherMode] ?? {}) }
    : readThemeTokens(baseTheme, otherMode);
  return {
    dark: editorMode === 'dark' ? editedModeTokens : otherModeTokens,
    light: editorMode === 'light' ? editedModeTokens : otherModeTokens,
  };
}
