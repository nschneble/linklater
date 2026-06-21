import { useCallback, useState } from 'react';
import { updateMe } from '../../../lib/api';
import { CUSTOM_TOKEN_KEYS } from '../../../theme/customTheme';
import { useTheme } from '../../../theme/ThemeContext';
import type { CustomTheme } from '../../../theme/customTheme';
import type { Mode } from '../../../theme/constants';
import type { ThemeVariable } from './useThemeOverrides';

/**
 * Builds the next `CustomTheme` by replacing only the CURRENT mode's tokens
 * with the editor's resolved values, preserving the other mode's saved
 * tokens. Filters to `CUSTOM_TOKEN_KEYS` and drops empty values so a stale or
 * unresolved variable can't leak into the persisted blob.
 */
function buildNextCustomTheme(
  existing: CustomTheme | null,
  mode: Mode,
  colorValues: Record<ThemeVariable, string>,
): CustomTheme {
  const modeTokens: Record<string, string> = {};
  for (const variable of CUSTOM_TOKEN_KEYS) {
    const value = colorValues[variable as ThemeVariable];
    if (typeof value === 'string' && value !== '') {
      modeTokens[variable] = value;
    }
  }
  return {
    dark: mode === 'dark' ? modeTokens : (existing?.dark ?? {}),
    light: mode === 'light' ? modeTokens : (existing?.light ?? {}),
  };
}

export interface UseThemeSaveResult {
  /** Whether a save round-trip is in flight. */
  isSaving: boolean;
  /** The last save error message, or `null` when none. */
  error: string | null;
  /**
   * Persists the current mode's tokens to localStorage (`setCustomTheme`) and
   * the backend (`PATCH /users/me`). Resolves to `true` on success, `false`
   * on failure (the error is also stored in `error`). A no-op while a save is
   * already in flight (re-activation suppression per a11y brief B1).
   */
  save: (colorValues: Record<ThemeVariable, string>) => Promise<boolean>;
}

/**
 * Owns the Theme Editor's Save state machine for the custom theme. Follows the
 * project's form-state sequence: clear error → set loading → attempt →
 * handle result. The handler suppresses re-entry while a request is in flight
 * so a rapid double-activation cannot fire two PATCHes.
 */
export function useThemeSave(): UseThemeSaveResult {
  const { customTheme, mode, setCustomTheme } = useTheme();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = useCallback(
    async (colorValues: Record<ThemeVariable, string>): Promise<boolean> => {
      if (isSaving) return false;
      setError(null);
      setIsSaving(true);
      const nextCustomTheme = buildNextCustomTheme(
        customTheme,
        mode,
        colorValues,
      );
      try {
        setCustomTheme(nextCustomTheme);
        await updateMe({ customTheme: nextCustomTheme });
        return true;
      } catch (caught) {
        setError(
          caught instanceof Error ? caught.message : 'Something went wrong',
        );
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [customTheme, isSaving, mode, setCustomTheme],
  );

  return { isSaving, error, save };
}
