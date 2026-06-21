import { EDITABLE_VARS } from '../components/settings/ThemeEditor/useThemeOverrides';
import { CUSTOM_THEME_STORAGE_KEY, readLocalStorage } from './storage';
import type { Mode } from './constants';

/**
 * The user's editable Custom theme: a per-mode map of bundle token names
 * (e.g. `--mount-border`) to CSS color strings. Mirrors the backend
 * `CustomTheme` shape persisted in the `customTheme` JSON column. Both modes
 * are optional; a freshly selected Custom theme with no saved tokens is an
 * empty map (or `null`).
 */
export interface CustomTheme {
  dark: Record<string, string>;
  light: Record<string, string>;
}

/**
 * The canonical set of bundle CSS variable names a Custom theme may define,
 * re-exported from the Theme Editor so the list stays single-sourced. Used to
 * filter server/localStorage token maps down to known keys before injecting
 * them onto `document.documentElement`, so a stale or hostile key can't leak
 * an arbitrary property onto the page.
 */
export const CUSTOM_TOKEN_KEYS: ReadonlyArray<string> = EDITABLE_VARS;

const CUSTOM_TOKEN_KEY_SET = new Set<string>(CUSTOM_TOKEN_KEYS);

/**
 * Narrows an unknown value (e.g. a parsed JSON blob from the server or
 * `localStorage`) into a `CustomTheme`. Non-object inputs and non-string
 * token values are dropped; keys outside `CUSTOM_TOKEN_KEYS` are ignored so
 * only known bundle variables can ever be injected.
 */
export function normalizeCustomTheme(value: unknown): CustomTheme | null {
  if (value === null || typeof value !== 'object') return null;
  const source = value as Record<string, unknown>;
  return {
    dark: pickKnownTokens(source['dark']),
    light: pickKnownTokens(source['light']),
  };
}

function pickKnownTokens(value: unknown): Record<string, string> {
  if (value === null || typeof value !== 'object') return {};
  const result: Record<string, string> = {};
  for (const [key, tokenValue] of Object.entries(value)) {
    if (CUSTOM_TOKEN_KEY_SET.has(key) && typeof tokenValue === 'string') {
      result[key] = tokenValue;
    }
  }
  return result;
}

/**
 * Reads and parses the Custom theme from `localStorage`. Returns `null` when
 * nothing is stored or the stored value can't be parsed.
 */
export function readStoredCustomTheme(): CustomTheme | null {
  const raw = readLocalStorage(CUSTOM_THEME_STORAGE_KEY);
  if (!raw) return null;
  try {
    return normalizeCustomTheme(JSON.parse(raw));
  } catch {
    return null;
  }
}

/**
 * Returns the token map for the given mode, or an empty object when the
 * Custom theme is null or has no tokens for that mode.
 */
export function tokensForMode(
  customTheme: CustomTheme | null,
  mode: Mode,
): Record<string, string> {
  if (!customTheme) return {};
  return customTheme[mode] ?? {};
}
