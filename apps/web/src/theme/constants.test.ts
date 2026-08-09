import {
  CVD_BASE_THEME,
  pickerThemes,
  THEMES,
  VALID_BASE_THEME_IDS,
  type BaseTheme,
} from './constants';
import { describe, expect, it } from 'vitest';

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
  it('contains exactly 11 themes', () => {
    expect(THEMES).toHaveLength(11);
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
      'custom',
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

describe('pickerThemes', () => {
  it('hides the custom theme when the opt-in is off and it is not active', () => {
    const ids = pickerThemes('scanner-darkly', false).map((theme) => theme.id);
    expect(ids).not.toContain('custom');
  });

  it('shows the custom theme when the opt-in is on', () => {
    const ids = pickerThemes('scanner-darkly', true).map((theme) => theme.id);
    expect(ids).toContain('custom');
  });

  it('shows the custom theme when it is active even with the opt-in off', () => {
    const ids = pickerThemes('custom', false).map((theme) => theme.id);
    expect(ids).toContain('custom');
  });

  it('always lists every built-in theme regardless of the opt-in', () => {
    const builtInIds = THEMES.filter((theme) => theme.id !== 'custom').map(
      (theme) => theme.id,
    );
    const visibleIds = pickerThemes('scanner-darkly', false).map(
      (theme) => theme.id,
    );
    for (const id of builtInIds) {
      expect(visibleIds).toContain(id);
    }
  });

  it('always lists the active theme (exactly-one-checked invariant)', () => {
    // aria-checked keys off `active === theme.id`; active theme must survive
    for (const theme of THEMES) {
      const visibleIds = pickerThemes(theme.id, false).map((entry) => entry.id);
      expect(visibleIds).toContain(theme.id);
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
