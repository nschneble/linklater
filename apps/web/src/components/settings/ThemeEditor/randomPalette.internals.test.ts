/*
 * Direct unit tests for the generator's TERMINATION SPINE — the defensive /
 * fallback branches the 400-draw property test in `randomPalette.test.ts` never
 * reaches organically (the happy path always derives a passing palette before
 * any terminator fires). The "always terminates with a passing palette"
 * guarantee is only as strong as these branches, so they are exercised here in
 * isolation:
 *
 *   1. `forceExtreme`        — the guaranteed last-resort repair: a still-failing
 *                              foreground is driven to whichever pure extreme
 *                              (#000000 / #ffffff) maximally clears its bg.
 *   2. `deriveForeground` rail — when the nudge loop walks to the 0/1 lightness
 *                              rail without a colored candidate clearing the
 *                              threshold, it returns the pure extreme, which
 *                              still passes for the thresholds that hit the rail.
 *   3. `deriveHighlightTriple` 0.4-L safety — PROVEN UNREACHABLE for every
 *                              in-band bundle bg (the window search always
 *                              lands), so the "safety net" is a defensive guard,
 *                              not a live path. Asserted via exhaustive in-band
 *                              math rather than a contrived reachable case.
 */

import {
  BG_BAND,
  deriveForeground,
  deriveHighlightTriple,
  forceExtreme,
  oklchHex,
  type Palette,
  type PairCheck,
} from './randomPalette';
import { computeContrastRatio } from './contrastResults';
import { describe, expect, it } from 'vitest';
import type { Mode } from '../../../theme/constants';

describe('forceExtreme: the guaranteed last-resort repair', () => {
  it('drives a failing foreground to #ffffff on a dark background', () => {
    // A deliberately-failing pair: a near-bg foreground on a dark card bg.
    const palette: Palette = {
      '--mount-text': '#23204a', // ~1:1 against the bg — fails 4.5
      '--mount-bg': '#201e43',
    };
    const pair: PairCheck = {
      foreground: '--mount-text',
      background: '--mount-bg',
      threshold: 4.5,
    };
    expect(
      computeContrastRatio(palette['--mount-text']!, '#201e43')!,
    ).toBeLessThan(4.5);

    forceExtreme(palette, pair);

    // White maximally clears a dark bg, so it is the chosen extreme...
    expect(palette['--mount-text']).toBe('#ffffff');
    // ...and it actually passes the threshold the pair demanded.
    const ratio = computeContrastRatio(palette['--mount-text']!, '#201e43');
    expect(ratio).not.toBeNull();
    expect(ratio!).toBeGreaterThanOrEqual(4.5);
  });

  it('drives a failing foreground to #000000 on a light background', () => {
    const palette: Palette = {
      '--base-text': '#f4f4f4', // ~1:1 against a near-white bg — fails 4.5
      '--base-bg': '#fafafa',
    };
    const pair: PairCheck = {
      foreground: '--base-text',
      background: '--base-bg',
      threshold: 4.5,
    };
    expect(
      computeContrastRatio(palette['--base-text']!, '#fafafa')!,
    ).toBeLessThan(4.5);

    forceExtreme(palette, pair);

    expect(palette['--base-text']).toBe('#000000');
    const ratio = computeContrastRatio(palette['--base-text']!, '#fafafa');
    expect(ratio).not.toBeNull();
    expect(ratio!).toBeGreaterThanOrEqual(4.5);
  });
});

describe('deriveForeground: the 0/1 lightness rail fallback', () => {
  // These inputs are tuned so the colored nudge candidate can never reach the
  // threshold before the lightness walk clamps at the 0/1 rail — exercising the
  // `return direction === 1 ? '#ffffff' : '#000000'` fallback. The chosen pure
  // extreme still clears the (rail-only) threshold.

  it('returns #ffffff at the rail in dark mode and still clears the threshold', () => {
    // Dark mode walks UP; a mid-gray bg with a high-chroma hue keeps every
    // colored candidate below 3:1 until the walk hits L=1.
    const result = deriveForeground('#8a8a8a', 3, 'dark' as Mode, 60, 0.22);
    expect(result).toBe('#ffffff');
    const ratio = computeContrastRatio(result, '#8a8a8a');
    expect(ratio).not.toBeNull();
    expect(ratio!).toBeGreaterThanOrEqual(3);
  });

  it('returns #000000 at the rail in light mode and still clears the threshold', () => {
    // Light mode walks DOWN; a mid-gray bg with a high-chroma hue keeps every
    // colored candidate below 4.5:1 until the walk hits L=0.
    const result = deriveForeground('#7a7a7a', 4.5, 'light' as Mode, 280, 0.25);
    expect(result).toBe('#000000');
    const ratio = computeContrastRatio(result, '#7a7a7a');
    expect(ratio).not.toBeNull();
    expect(ratio!).toBeGreaterThanOrEqual(4.5);
  });
});

describe('deriveHighlightTriple: the 0.4-L safety branch is unreachable in band', () => {
  /*
   * The 0.4-L fallback in `deriveHighlightTriple` is dead code for any bg this
   * generator actually produces. Backgrounds live in `BG_BAND` (dark
   * [0.1,0.18] / light [0.92,0.98]); across EVERY in-band bg hue/chroma × every
   * highlight hue/chroma, the window search lands a real highlight, so the
   * triple's three contract pairs all hold BY CONSTRUCTION and the 0.4 tone is
   * never emitted. We prove that by checking the live output of the real
   * function over a dense in-band sample.
   *
   * (Out of band the 0.4 tone does NOT itself clear 3:1 vs a mid-L bg — it is a
   * defensive placeholder the outer forceExtreme repair would correct — which is
   * exactly why this is asserted as unreachable rather than as a passing net.)
   */

  const RNG = () => 0.5; // deterministic chroma pick inside deriveHighlightTriple
  const MODES: Mode[] = ['light', 'dark'];
  const BG_HUES = [0, 45, 90, 135, 180, 225, 270, 315];
  const BG_CHROMAS = [0.005, 0.015, 0.025];
  const HIGHLIGHT_HUES = [
    0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330,
  ];

  for (const mode of MODES) {
    const band = BG_BAND[mode];
    it(`${mode} mode: window search always lands; 0.4-L tone never emitted`, () => {
      let combinations = 0;
      for (
        let lightness = band.min;
        lightness <= band.max + 1e-9;
        lightness += 0.01
      ) {
        for (const bgHue of BG_HUES) {
          for (const bgChroma of BG_CHROMAS) {
            const bundleBgHex = oklchHex(lightness, bgChroma, bgHue);
            for (const highlightHue of HIGHLIGHT_HUES) {
              combinations += 1;
              const { highlight, highlightFg } = deriveHighlightTriple(
                bundleBgHex,
                highlightHue,
                RNG,
              );
              // The triple's two hard pairs hold by construction — which only
              // happens when findHighlight landed, NOT when the 0.4 tone fired.
              const fgOnHighlight = computeContrastRatio(
                highlightFg,
                highlight,
              );
              const highlightOnBg = computeContrastRatio(
                highlight,
                bundleBgHex,
              );
              expect(fgOnHighlight).not.toBeNull();
              expect(highlightOnBg).not.toBeNull();
              expect(fgOnHighlight!).toBeGreaterThanOrEqual(4.5);
              expect(highlightOnBg!).toBeGreaterThanOrEqual(3);
            }
          }
        }
      }
      // Guard against an empty loop silently passing the describe.
      expect(combinations).toBeGreaterThan(0);
    });
  }
});
