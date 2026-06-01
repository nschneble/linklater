import { describe, expect, it } from 'vitest';
import {
  CVD_BASE_THEME,
  THEMES,
  VALID_BASE_THEME_IDS,
  type BaseTheme,
} from './constants';

describe('CVD_BASE_THEME', () => {
  it('is the apollo-10-1-2 theme', () => {
    expect(CVD_BASE_THEME).toBe('apollo-10-1-2');
  });

  it('is a member of the THEMES array', () => {
    const themeIds = THEMES.map((theme) => theme.id);
    expect(themeIds).toContain(CVD_BASE_THEME);
  });
});

describe('THEMES', () => {
  it('contains exactly 10 themes', () => {
    expect(THEMES).toHaveLength(10);
  });

  it('every theme has a non-empty id, label, accent, and swatchIcon', () => {
    for (const theme of THEMES) {
      expect(theme.id).toBeTruthy();
      expect(theme.label).toBeTruthy();
      expect(theme.accent).toBeTruthy();
      expect(theme.swatchIcon).toBeTruthy();
    }
  });

  it('all theme ids are unique', () => {
    const ids = THEMES.map((theme) => theme.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('all accent colors are valid CSS hex colors', () => {
    const hexColorPattern = /^#[0-9a-fA-F]{6}$/;
    for (const theme of THEMES) {
      expect(theme.accent).toMatch(hexColorPattern);
    }
  });

  it('marks the apollo-10-1-2 theme as accessible', () => {
    const apolloTheme = THEMES.find((theme) => theme.id === 'apollo-10-1-2');
    expect(apolloTheme?.isAccessible).toBe(true);
  });

  it('does not mark non-apollo themes as accessible', () => {
    const nonApolloThemes = THEMES.filter(
      (theme) => theme.id !== 'apollo-10-1-2',
    );
    for (const theme of nonApolloThemes) {
      expect(theme.isAccessible).toBeUndefined();
    }
  });

  it('includes all expected theme ids', () => {
    const expectedIds: BaseTheme[] = [
      'apollo-10-1-2',
      'before-midnight',
      'before-sunrise',
      'before-sunset',
      'boyhood',
      'dazed-and-confused',
      'hit-man',
      'nouvelle-vague',
      'scanner-darkly',
      'school-of-rock',
    ];
    const actualIds = THEMES.map((theme) => theme.id);
    for (const expectedId of expectedIds) {
      expect(actualIds).toContain(expectedId);
    }
  });
});

describe('VALID_BASE_THEME_IDS', () => {
  it('contains all theme ids from the THEMES array', () => {
    for (const theme of THEMES) {
      expect(VALID_BASE_THEME_IDS.has(theme.id)).toBe(true);
    }
  });

  it('has the same size as the THEMES array', () => {
    expect(VALID_BASE_THEME_IDS.size).toBe(THEMES.length);
  });

  it('does not contain unknown theme ids', () => {
    expect(VALID_BASE_THEME_IDS.has('not-a-theme')).toBe(false);
    expect(VALID_BASE_THEME_IDS.has('')).toBe(false);
  });

  it('contains the CVD base theme', () => {
    expect(VALID_BASE_THEME_IDS.has(CVD_BASE_THEME)).toBe(true);
  });
});
