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

/*
 * The OFF-BOOK `branding` theme invisibility contract. `branding` ships ONLY
 * as a CSS cascade (theme/styles/branding.css) plus the `data-theme='branding'`
 * attribute ApiDocsView/LandingPage set directly on their wrappers when logged
 * out. It is DELIBERATELY absent from every user-facing theme registry so it
 * never appears in the theme editor and no user can persist it as their theme.
 *
 * branding.css's header asserts this absence in prose, but nothing enforced it:
 * adding `'branding'` to THEMES or the API VALID_THEMES allow-list would leak
 * the marketing chrome into the picker (and let a crafted PATCH /me persist it)
 * while every existing test stayed green. This guard mechanizes the contract.
 *
 * The API-side allow-list (apps/api/src/users/users.constants.ts VALID_THEMES)
 * is covered by its own back-end spec to keep this front-end suite from
 * reaching across the workspace boundary.
 */
describe('branding off-book theme invisibility contract', () => {
  it('is absent from the THEMES picker array', () => {
    const ids = THEMES.map((theme) => theme.id);
    expect(ids).not.toContain('branding');
  });

  it('is absent from the VALID_BASE_THEME_IDS allow-list', () => {
    expect(VALID_BASE_THEME_IDS.has('branding')).toBe(false);
  });
});
