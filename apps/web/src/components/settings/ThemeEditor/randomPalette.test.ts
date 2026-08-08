/*
 * The airtight gate for the "Randomize" button (PRD point 11): the generator
 * MUST emit a palette that clears the FULL WCAG AA contract the live editor
 * enforces, for both modes, across many random draws.
 *
 * The pair list is rebuilt from the editor's OWN exported builders
 * (`pairsForBundle` + `focusRingPairs`) rather than hand-copied, so this test
 * can never drift from the contract it guards - if the contract grows a pair,
 * this gate grows with it. Every pair is checked through `computeContrastRatio`,
 * the two-endpoint ratio the generator solves against, and the `ratio !== null`
 * assertion proves no alpha / non-hex value ever slipped into the palette (which
 * would be a SILENT contract hole, since `computeContrastRatio` returns null on
 * such input). A second gate below runs the same palettes through the live
 * checker's composited evaluator, so the two models cannot quietly part ways.
 */

import { BUNDLES } from './useThemeOverrides';
import {
  computeContrastRatio,
  focusRingPairs,
  pairsForBundle,
} from './contrastResults';
import { describe, expect, it } from 'vitest';
import { EDITABLE_VARS } from '../../../theme/customThemeTokens';
import { evaluatePair } from './contrastResults.evaluate';
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
    // 42 (7×6) + 6 cross-bundle + 1 subtle-text + 3 focus-ring = 52; pin it
    expect(CONTRACT_PAIRS).toHaveLength(52);
  });

  for (const mode of MODES) {
    describe(`${mode} mode`, () => {
      for (let iteration = 0; iteration < ITERATIONS; iteration += 1) {
        const seed = iteration + (mode === 'dark' ? 100000 : 0);
        it(`iteration ${iteration} (seed ${seed}) clears every pair + is complete`, () => {
          const palette = generateRandomPalette(mode, seed);

          // every var present + a 6-digit hex so the contrast math can resolve it
          for (const variable of EDITABLE_VARS) {
            const value = palette[variable as ThemeVariable];
            expect.soft(value, `${variable} present`).toBeDefined();
            expect.soft(value, `${variable} is 6-digit hex`).toMatch(HEX_6);
          }

          // each pair clears its threshold; null-guard catches any alpha/non-hex
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

/*
 * The generator and the live checker use DIFFERENT contrast models: the
 * generator solves two-endpoint opaque ratios, the checker scores each pair on
 * the worst of the render stacks its background composites down. The generator
 * gets away with the simpler model only because it emits opaque hex, on which
 * compositing short-circuits.
 *
 * That is an argument, not a guarantee, and nothing held it. This does: it
 * runs generated palettes through the checker itself, so a change to either
 * side that breaks the equivalence fails here rather than shipping a
 * Randomize button whose output the editor then flags.
 */
describe('a generated palette clears the checker it was generated against', () => {
  for (const mode of MODES) {
    it(`${mode} mode passes the composited evaluator`, () => {
      for (let iteration = 0; iteration < 25; iteration += 1) {
        const seed = iteration + (mode === 'dark' ? 200000 : 1000);
        const palette = generateRandomPalette(mode, seed);
        const resolve = (token: string) =>
          palette[token as ThemeVariable] ?? '';

        for (const pair of CONTRACT_PAIRS) {
          const evaluation = evaluatePair(
            pair.foreground,
            pair.background,
            resolve,
          );
          expect
            .soft(evaluation.unmeasurable, `${pair.label} (seed ${seed})`)
            .toBe(0);
          expect
            .soft(
              evaluation.ratio ?? 0,
              `${pair.label} ≥ ${pair.threshold} (seed ${seed})`,
            )
            .toBeGreaterThanOrEqual(pair.threshold);
        }
      }
    });
  }
});
