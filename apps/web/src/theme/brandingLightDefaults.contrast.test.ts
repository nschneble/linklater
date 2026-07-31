/*
 * Bundle contrast + CVD contract for the Custom theme's LIGHT default palette
 * (`BRANDING_DEFAULTS_LIGHT`).
 *
 * The off-book `branding` theme has no light cascade, so this palette lives
 * only as a TS map and is never parsed by `bundles.contrast.test.ts` (which
 * scans `BUNDLES_CSS`). This suite feeds the map through the SAME
 * `bundles-color-utils` helpers so the light default satisfies the identical
 * WCAG-AA contract the .css themes do - text/alt-text/state-text ≥ 4.5:1,
 * border/highlight ≥ 3:1, highlight-fg ≥ 4.5:1, card borders ≥ 3:1 vs the page
 * bg - plus the CVD-distinguishability invariant (axis A: ΔE2000 ≥ 10 under all
 * three dichromacies, OR axis B: luminance ratio ≥ 1.4) for every state-bundle
 * pair. All backgrounds are solid hex, so no alpha compositing is needed.
 *
 * Every assertion is its own `it` so a failure names the exact offending pair;
 * the `vitest/valid-expect` two-arg message form is not available to `src`
 * tests (only the scripts block disables that rule).
 */

import {
  CARD_BUNDLES,
  CVD_TYPES,
  STATE_BUNDLES,
  contrastRatio,
  luminanceRatio,
  parseColor,
  resolveFg,
  cvdDeltaE,
} from './styles/bundles-color-utils';
import { BRANDING_DEFAULTS_LIGHT } from './brandingDefaults';
import { CUSTOM_TOKEN_KEYS } from './customTheme';
import { describe, expect, it } from 'vitest';
import type { Bundle, Rgb } from './styles/bundles-color-utils';

const AA_NORMAL = 4.5;
const AA_NON_TEXT = 3;
const CVD_JND = 10;
const LUMINANCE_SPLIT = 1.4;

const ALL_BUNDLES: readonly Bundle[] = [
  'base',
  'mount',
  'orbit',
  'alert',
  'warn',
  'info',
  'success',
];

const PAGE_BG = '--base-bg';

function rgb(key: string): Rgb {
  const value = BRANDING_DEFAULTS_LIGHT[key];
  if (value === undefined) {
    throw new Error(`BRANDING_DEFAULTS_LIGHT missing ${key}`);
  }
  return resolveFg(parseColor(value));
}

function ratio(fgKey: string, bgKey: string): number {
  return contrastRatio(rgb(fgKey), rgb(bgKey));
}

describe('BRANDING_DEFAULTS_LIGHT covers every editable token', () => {
  for (const key of CUSTOM_TOKEN_KEYS) {
    it(`defines ${key}`, () => {
      expect(BRANDING_DEFAULTS_LIGHT[key]).toBeDefined();
    });
  }
});

describe('BRANDING_DEFAULTS_LIGHT per-bundle contrast (SC 1.4.3 / 1.4.11)', () => {
  for (const bundle of ALL_BUNDLES) {
    const pairs: Array<[string, string, number]> = [
      [`--${bundle}-text`, `--${bundle}-bg`, AA_NORMAL],
      [`--${bundle}-alt-text`, `--${bundle}-bg`, AA_NORMAL],
      [`--${bundle}-border`, `--${bundle}-bg`, AA_NON_TEXT],
      [`--${bundle}-highlight`, `--${bundle}-bg`, AA_NON_TEXT],
      [`--${bundle}-highlight-fg`, `--${bundle}-highlight`, AA_NORMAL],
      [`--${bundle}-highlight-fg`, `--${bundle}-highlight-hover`, AA_NORMAL],
    ];
    for (const [fg, bg, threshold] of pairs) {
      it(`${fg} on ${bg} clears ${threshold}:1`, () => {
        expect(ratio(fg, bg)).toBeGreaterThanOrEqual(threshold);
      });
    }
  }
});

describe('BRANDING_DEFAULTS_LIGHT cross-bundle contrast', () => {
  for (const bundle of CARD_BUNDLES) {
    it(`--${bundle}-border clears 3:1 against the page bg`, () => {
      expect(ratio(`--${bundle}-border`, PAGE_BG)).toBeGreaterThanOrEqual(
        AA_NON_TEXT,
      );
    });
  }

  it('base subtle-text clears 4.5:1 against the base bg', () => {
    expect(ratio('--base-subtle-text', '--base-bg')).toBeGreaterThanOrEqual(
      AA_NORMAL,
    );
  });

  for (const bundle of ['base', 'mount'] as const) {
    it(`--${bundle}-text clears 4.5:1 against its input bg`, () => {
      expect(
        ratio(`--${bundle}-text`, `--${bundle}-input-bg`),
      ).toBeGreaterThanOrEqual(AA_NORMAL);
    });
    it(`--${bundle}-alt-text clears 4.5:1 against its input bg`, () => {
      expect(
        ratio(`--${bundle}-alt-text`, `--${bundle}-input-bg`),
      ).toBeGreaterThanOrEqual(AA_NORMAL);
    });
    it(`--${bundle}-border clears 3:1 against its input bg`, () => {
      expect(
        ratio(`--${bundle}-border`, `--${bundle}-input-bg`),
      ).toBeGreaterThanOrEqual(AA_NON_TEXT);
    });
  }

  for (const bundle of STATE_BUNDLES) {
    it(`--${bundle}-text clears 4.5:1 against the page bg`, () => {
      expect(ratio(`--${bundle}-text`, PAGE_BG)).toBeGreaterThanOrEqual(
        AA_NORMAL,
      );
    });
  }

  const focusSurfaces = [
    '--base-bg',
    '--mount-bg',
    '--orbit-bg',
    '--alert-bg',
    '--warn-bg',
    '--info-bg',
    '--success-bg',
    '--base-input-bg',
  ];
  for (const surface of focusSurfaces) {
    it(`--focus-ring clears 3:1 against ${surface}`, () => {
      expect(ratio('--focus-ring', surface)).toBeGreaterThanOrEqual(
        AA_NON_TEXT,
      );
    });
  }
});

describe('BRANDING_DEFAULTS_LIGHT state-bundle CVD distinguishability', () => {
  const pairs: Array<[Bundle, Bundle]> = [];
  for (let first = 0; first < STATE_BUNDLES.length; first += 1) {
    for (let second = first + 1; second < STATE_BUNDLES.length; second += 1) {
      pairs.push([STATE_BUNDLES[first], STATE_BUNDLES[second]]);
    }
  }

  for (const [first, second] of pairs) {
    for (const cvd of CVD_TYPES) {
      it(`${first} vs ${second} is distinguishable under ${cvd}`, () => {
        const bgLum = luminanceRatio(
          rgb(`--${first}-bg`),
          rgb(`--${second}-bg`),
        );
        const borderLum = luminanceRatio(
          rgb(`--${first}-border`),
          rgb(`--${second}-border`),
        );
        const axisB = bgLum >= LUMINANCE_SPLIT || borderLum >= LUMINANCE_SPLIT;

        const bgDelta = cvdDeltaE(
          rgb(`--${first}-bg`),
          rgb(`--${second}-bg`),
          cvd,
        );
        const borderDelta = cvdDeltaE(
          rgb(`--${first}-border`),
          rgb(`--${second}-border`),
          cvd,
        );
        const axisA = bgDelta >= CVD_JND || borderDelta >= CVD_JND;

        expect(axisA || axisB).toBe(true);
      });
    }
  }
});
