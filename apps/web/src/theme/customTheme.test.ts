import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  collectTokens,
  isCustomThemeConfigured,
  normalizeCustomTheme,
  readStoredCustomTheme,
  tokensForMode,
} from './customTheme';
import { CUSTOM_THEME_STORAGE_KEY } from './storage';

// A token in the canonical set and one that is not, so the trust-boundary
// filtering can be exercised without hard-coding the whole 53-key list.
const KNOWN_KEY = '--mount-border';
const UNKNOWN_KEY = '--not-a-real-token';

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
});

describe('normalizeCustomTheme', () => {
  it('returns null for non-object input', () => {
    expect(normalizeCustomTheme('nope')).toBeNull();
    expect(normalizeCustomTheme(42)).toBeNull();
    expect(normalizeCustomTheme(true)).toBeNull();
  });

  it('returns null for null input', () => {
    expect(normalizeCustomTheme(null)).toBeNull();
  });

  it('returns empty maps when both modes are absent', () => {
    expect(normalizeCustomTheme({})).toEqual({ dark: {}, light: {} });
  });

  it('drops keys outside the canonical set', () => {
    const result = normalizeCustomTheme({
      dark: { [KNOWN_KEY]: '#123456', [UNKNOWN_KEY]: '#abcdef' },
      light: {},
    });
    expect(result).toEqual({ dark: { [KNOWN_KEY]: '#123456' }, light: {} });
  });

  it('drops non-string token values', () => {
    const result = normalizeCustomTheme({
      dark: { [KNOWN_KEY]: 42, '--mount-text': '#ffffff' },
      light: {},
    });
    expect(result).toEqual({ dark: { '--mount-text': '#ffffff' }, light: {} });
  });

  it('drops non-object dark/light into empty maps', () => {
    const result = normalizeCustomTheme({ dark: 'oops', light: null });
    expect(result).toEqual({ dark: {}, light: {} });
  });
});

describe('readStoredCustomTheme', () => {
  it('returns null when the key is absent', () => {
    expect(readStoredCustomTheme()).toBeNull();
  });

  it('returns null on corrupt JSON', () => {
    window.localStorage.setItem(CUSTOM_THEME_STORAGE_KEY, '{not valid json');
    expect(readStoredCustomTheme()).toBeNull();
  });

  it('round-trips a valid blob through normalization', () => {
    const blob = {
      dark: { [KNOWN_KEY]: '#101010', [UNKNOWN_KEY]: '#999999' },
      light: { '--base-bg': '#fafafa' },
    };
    window.localStorage.setItem(CUSTOM_THEME_STORAGE_KEY, JSON.stringify(blob));
    expect(readStoredCustomTheme()).toEqual({
      dark: { [KNOWN_KEY]: '#101010' },
      light: { '--base-bg': '#fafafa' },
    });
  });
});

describe('tokensForMode', () => {
  it('returns an empty object for a null theme', () => {
    expect(tokensForMode(null, 'dark')).toEqual({});
  });

  it('returns an empty object for an absent mode', () => {
    expect(tokensForMode({ dark: {}, light: {} }, 'light')).toEqual({});
  });

  it('returns the correct map for a populated mode', () => {
    const theme = {
      dark: { [KNOWN_KEY]: '#222222' },
      light: { '--base-bg': '#eeeeee' },
    };
    expect(tokensForMode(theme, 'dark')).toEqual({ [KNOWN_KEY]: '#222222' });
  });
});

describe('isCustomThemeConfigured', () => {
  it('is false for null', () => {
    expect(isCustomThemeConfigured(null)).toBe(false);
  });

  it('is false when both modes are empty', () => {
    expect(isCustomThemeConfigured({ dark: {}, light: {} })).toBe(false);
  });

  it('is true when either mode has at least one token', () => {
    expect(
      isCustomThemeConfigured({ dark: { [KNOWN_KEY]: '#000000' }, light: {} }),
    ).toBe(true);
    expect(
      isCustomThemeConfigured({ dark: {}, light: { '--base-bg': '#fff' } }),
    ).toBe(true);
  });
});

describe('collectTokens', () => {
  it('keeps only non-empty string values read via the getter', () => {
    const source: Record<string, string> = {
      [KNOWN_KEY]: '#123123',
      '--base-bg': '',
    };
    const result = collectTokens(
      [KNOWN_KEY, '--base-bg', '--mount-text'],
      (key) => source[key],
    );
    expect(result).toEqual({ [KNOWN_KEY]: '#123123' });
  });

  it('returns an empty object when the getter yields nothing', () => {
    expect(collectTokens([KNOWN_KEY], () => undefined)).toEqual({});
  });
});
