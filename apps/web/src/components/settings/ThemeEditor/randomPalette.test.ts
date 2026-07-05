/*
 * The airtight gate for the "Randomize" button (PRD point 11): the generator
 * MUST emit a palette that clears the FULL WCAG AA contract the live editor
 * enforces, for both modes, across many random draws.
 *
 * The pair list is rebuilt from the editor's OWN exported builders
 * (`pairsForBundle` + `focusRingPairs`) rather than hand-copied, so this test
 * can never drift from the contract it guards — if the contract grows a pair,
 * this gate grows with it. Every pair is checked through the editor's OWN
 * `computeContrastRatio` (the single source of truth), and the `ratio !== null`
 * assertion proves no alpha / non-hex value ever slipped into the palette (which
 * would be a SILENT contract hole, since `computeContrastRatio` returns null on
 * such input).
 */

import {
  computeContrastRatio,
  focusRingPairs,
  pairsForBundle,
} from './contrastResults';
import { describe, expect, it } from 'vitest';
import { EDITABLE_VARS } from '../../../theme/customThemeTokens';
import { BUNDLES } from './useThemeOverrides';
import { generateRandomPalette } from './randomPalette';
import type { Mode } from '../../../theme/constants';
import type { ThemeVariable } from './useThemeOverrides';

/**
 * The exact pair set the editor's `useContrastResults` builds: every bundle's
 * `pairsForBundle` plus the focus-ring pairs. Imported from the contract module
 * so the gate and the live checker share one source.
 */
const CONTRACT_PAIRS = [
  ...BUNDLES.flatMap((bundle) => pairsForBundle(bundle)),
  ...focusRingPairs(),
];

const MODES: Mode[] = ['light', 'dark'];
const ITERATIONS = 200;
const HEX_6 = /^#[0-9a-fA-F]{6}$/;

describe('generateRandomPalette: the 52-pair WCAG AA contract', () => {
  it('rebuilds exactly 52 contract pairs from the editor builders', () => {
    // 7 bundles × 6 base pairs = 42; +6 cross-bundle border/base-bg (card
    // bundles); +1 base subtle-text; +3 focus-ring = 52. Pin the count so a
    // contract change is a conscious, reviewed edit.
    expect(CONTRACT_PAIRS).toHaveLength(52);
  });

  for (const mode of MODES) {
    describe(`${mode} mode`, () => {
      for (let iteration = 0; iteration < ITERATIONS; iteration += 1) {
        const seed = iteration + (mode === 'dark' ? 100000 : 0);
        it(`iteration ${iteration} (seed ${seed}) clears every pair + is complete`, () => {
          const palette = generateRandomPalette(mode, seed);

          // Completeness: every editable var present + a clean 6-digit hex (so
          // none can be an alpha/non-hex value the contrast math can't resolve).
          for (const variable of EDITABLE_VARS) {
            const value = palette[variable as ThemeVariable];
            expect.soft(value, `${variable} present`).toBeDefined();
            expect.soft(value, `${variable} is 6-digit hex`).toMatch(HEX_6);
          }

          // Every contract pair clears its threshold, AND its ratio resolved
          // (the null-guard proves no alpha/non-hex slipped in).
          for (const pair of CONTRACT_PAIRS) {
            const foreground = palette[pair.foreground as ThemeVariable];
            const background = palette[pair.background as ThemeVariable];
            const ratio = computeContrastRatio(foreground, background);
            expect
              .soft(ratio, `${pair.label} resolved (seed ${seed})`)
              .not.toBe(null);
            expect
              .soft(
                ratio ?? 0,
                `${pair.label} ≥ ${pair.threshold} (seed ${seed})`,
              )
              .toBeGreaterThanOrEqual(pair.threshold);
          }
        });
      }
    });
  }
});
