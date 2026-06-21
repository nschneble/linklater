import { CUSTOM_THEME_STORAGE_KEY, readLocalStorage } from './storage';
import { EDITABLE_VARS } from './customThemeTokens';
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
 * The canonical set of bundle CSS variable names a Custom theme may define.
 * Single-sourced in `customThemeTokens.ts` (core theme data) and re-exported
 * here for the runtime injection + trust-boundary normalize paths. Used to
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

/**
 * Trust-boundary filter over UNTRUSTED entries: keeps only known token keys
 * with string values. Distinct from `collectTokens`, which walks the trusted
 * canonical key list via a getter.
 */
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
 * Walks the given canonical `keys`, reading each value via `read`, and keeps
 * only the non-empty string results. Shared by the editor's copy/load/save
 * paths, which each iterate the canonical key set against a different getter
 * (live `colorValues`, a computed-style probe). Trusted-input path; do NOT use
 * for untrusted blobs (see `pickKnownTokens`).
 */
export function collectTokens(
  keys: ReadonlyArray<string>,
  read: (key: string) => string | undefined,
): Record<string, string> {
  const tokens: Record<string, string> = {};
  for (const key of keys) {
    const value = read(key);
    if (typeof value === 'string' && value !== '') {
      tokens[key] = value;
    }
  }
  return tokens;
}

/**
 * Whether the Custom theme is "set up" – the user has saved at least one token
 * in either mode. Until then the picker entry carries an sr-only ", not set
 * up" qualifier (WCAG 2.5.3).
 */
export function isCustomThemeConfigured(
  customTheme: CustomTheme | null,
): boolean {
  return (
    !!customTheme &&
    (Object.keys(customTheme.dark).length > 0 ||
      Object.keys(customTheme.light).length > 0)
  );
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
