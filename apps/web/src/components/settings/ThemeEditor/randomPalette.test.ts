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
  derivePaletteOnce,
  generateRandomPalette,
} from './randomPalette';
import { describe, expect, it } from 'vitest';
import { EDITABLE_VARS } from '../../../theme/customThemeTokens';
import { evaluatePair } from './contrastResults.evaluate';
import { focusRingPairs, pairsForBundle } from './contrastResults.pairs';
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
const DERIVATIONS = 2000;
// a few thousand derivations is not a unit test; CI runners are slow
// enough that the 5s default is a coin flip rather than a real bound
const SWEEP_TIMEOUT_MS = 60_000;
const HEX_6 = /^#[0-9a-fA-F]{6}$/;

describe('generateRandomPalette: the 60-pair WCAG AA contract', () => {
  it('rebuilds exactly 60 contract pairs from the editor builders', () => {
    // 42 (7×6) + 6 cross-bundle + 1 subtle + 6 input-fill + 5 focus-ring
    expect(CONTRACT_PAIRS).toHaveLength(60);
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
 * DERIVE-TO-SATISFY, held directly rather than inferred.
 *
 * The gate above runs the public entry point, which throws a failing draw
 * away and repairs the last one, so it stays green over a derivation that
 * has stopped solving a pair. That is not hypothetical: adding the
 * input-fill pairs to the contract turned that gate green on its own while
 * more than half of all light draws still failed them. This runs ONE
 * derivation per seed, with nothing behind it to launder the result.
 *
 * It collects failures and asserts once rather than asserting per pair.
 * At this sweep size that is 120k soft assertions, which cost more than
 * the derivations they check and timed the job out on a CI runner.
 */
describe('one derivation clears the contract before any repair', () => {
  for (const mode of MODES) {
    it(
      `${mode} mode needs no second attempt`,
      () => {
        const failures: string[] = [];

        for (let iteration = 0; iteration < DERIVATIONS; iteration += 1) {
          const seed = iteration + (mode === 'dark' ? 300000 : 2000);
          const palette = derivePaletteOnce(mode, seed);

          for (const pair of CONTRACT_PAIRS) {
            const ratio =
              computeContrastRatio(
                palette[pair.foreground as ThemeVariable] ?? '',
                palette[pair.background as ThemeVariable] ?? '',
              ) ?? 0;
            if (ratio < pair.threshold) {
              failures.push(
                `${pair.label} (seed ${seed}): ${ratio.toFixed(3)} < ${pair.threshold}`,
              );
            }
          }
        }

        expect(failures.slice(0, 10)).toEqual([]);
        expect(failures).toHaveLength(0);
      },
      SWEEP_TIMEOUT_MS,
    );
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
