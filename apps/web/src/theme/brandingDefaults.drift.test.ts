import { BRANDING_DEFAULTS } from './brandingDefaults';
import { CUSTOM_TOKEN_KEYS } from './customTheme';
import {
  BUNDLES_CSS,
  extractBlock,
  parseDeclarations,
} from './styles/bundles-color-utils';
import { describe, expect, it } from 'vitest';

/**
 * Anti-drift tripwire: `BRANDING_DEFAULTS` is a runtime snapshot of the
 * off-book `branding` theme (branding.css), used as the Custom theme's dark
 * default. It is hand-maintained as a plain object (branding.css can't be read
 * in the browser), so this test parses the actual cascade and asserts the two
 * stay byte-for-byte in sync.
 */
describe('BRANDING_DEFAULTS stays in sync with branding.css', () => {
  const declarations = parseDeclarations(
    extractBlock(BUNDLES_CSS, "[data-theme='branding']"),
  );

  /*
   * Branding-chrome-only tokens: NOT part of the editable Custom palette
   * (absent from EDITABLE_VARS/CUSTOM_TOKEN_KEYS), so they are deliberately
   * excluded from the `BRANDING_DEFAULTS` snapshot. `--page-gradient-{from,to}`
   * back the logged-out AuthCard wrapper and `--border-shadow-color` pins the
   * mode-independent card-edge tint; both live only in branding.css. Excluded
   * from the byte-for-byte comparison so the Custom-fallback snapshot stays
   * scoped to the injectable palette.
   */
  const CHROME_ONLY_KEYS = [
    '--page-gradient-from',
    '--page-gradient-to',
    '--border-shadow-color',
  ];

  it('matches every branding.css token value exactly', () => {
    const fromCss: Record<string, string> = {};
    for (const [key, value] of declarations) {
      if (CHROME_ONLY_KEYS.includes(`--${key}`)) {
        continue;
      }
      fromCss[`--${key}`] = value;
    }
    expect(BRANDING_DEFAULTS).toEqual(fromCss);
  });

  it('covers every editable Custom theme token', () => {
    for (const key of CUSTOM_TOKEN_KEYS) {
      expect(BRANDING_DEFAULTS[key]).toBeDefined();
    }
  });
});
