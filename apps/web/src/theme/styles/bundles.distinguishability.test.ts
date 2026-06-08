/*
 * Bundle CVD-distinguishability contract — automated luminance-gap check.
 *
 * Encodes axis B of feedback-bundle-hue-separation:
 *
 *   Within a single theme, every pair of state bundles (alert / warn /
 *   info / success) MUST be distinguishable on at least one of two axes:
 *
 *     Axis A — hue family that survives all four CVD simulations
 *              (protanopia, deuteranopia, tritanopia, monochromatism).
 *     Axis B — luminance gap of >=1.4x between the two bundles' borders
 *              AND between their backgrounds.
 *
 *   When neither axis is satisfied, the consuming component MUST carry
 *   redundant non-color signal: distinct icon glyph, prefix label, or
 *   structural marker.
 *
 * Axis A is deferred (needs Brettel/Vienot CVD-simulation matrices) — see
 * deferred-future-work note at bottom. This file mechanizes axis B; pairs
 * that fail B without a documented shape-redundancy waiver soft-fail.
 *
 * Sister suite: bundles.contrast.test.ts encodes WCAG SC 1.4.3 + 1.4.11.
 * Shared color parsing + WCAG helpers live in bundles-color-utils.ts.
 *
 * A note on the luminance metric: distinguishability uses a SYMMETRIC
 * `lighter / darker` ratio (no +0.05 offset). The WCAG +0.05 is calibrated
 * for text/bg legibility, not for surface-vs-surface separability. Two
 * adjacent panels with identical luminance are indistinguishable by
 * luminance alone — ratio 1.0 — which is what we test against.
 */

import { describe, expect, it } from 'vitest';
import {
  BUNDLES_CSS,
  DEFAULT_CSS,
  STATE_BUNDLES,
  compositeOverBg,
  describeRatio,
  extractBlock,
  getSlot,
  luminanceRatio,
  parseDeclarations,
  readPageBg,
  resolveFg,
} from './bundles-color-utils';
import type { Bundle, Rgb } from './bundles-color-utils';

const LUMINANCE_GAP_THRESHOLD = 1.4;

interface CascadeFixture {
  readonly label: string;
  readonly selector: string;
  /*
   * Page background to composite alpha bundle-bgs over. Dark bundles use
   * `rgb(... / 0.4)` for --{bundle}-bg, so the visible bg luminance only
   * makes sense after compositing over the page surface beneath.
   */
  readonly pageBg: Rgb;
}

const DEFAULT_PAGE_BG: Rgb = readPageBg(DEFAULT_CSS, ':root', 'bg');
const SCHOOL_OF_ROCK_LIGHT_PAGE_BG: Rgb = readPageBg(
  BUNDLES_CSS,
  "[data-theme='school-of-rock'][data-mode='light']",
  'base-bg',
);
const SCHOOL_OF_ROCK_DARK_PAGE_BG: Rgb = readPageBg(
  BUNDLES_CSS,
  "[data-theme='school-of-rock'][data-mode='dark']",
  'base-bg',
);

const FIXTURES: readonly CascadeFixture[] = [
  {
    label: ':root (default state bundles)',
    selector: ':root',
    pageBg: DEFAULT_PAGE_BG,
  },
  {
    label: "[data-mode='dark'] (default dark state bundles)",
    selector: "[data-mode='dark']",
    pageBg: DEFAULT_PAGE_BG,
  },
  {
    label: 'school-of-rock light',
    selector: "[data-theme='school-of-rock'][data-mode='light']",
    pageBg: SCHOOL_OF_ROCK_LIGHT_PAGE_BG,
  },
  {
    label: 'school-of-rock dark',
    selector: "[data-theme='school-of-rock'][data-mode='dark']",
    pageBg: SCHOOL_OF_ROCK_DARK_PAGE_BG,
  },
];

/*
 * Documented waivers: cascade-pair combos where consuming components
 * (Alert.tsx + StatusBadge.tsx) carry shape redundancy that satisfies the
 * axis-A/axis-B fallback of feedback-bundle-hue-separation.
 *
 * Key format: `${cascade-slug}::${bundleA}-${bundleB}` (sorted alphabetically
 * by bundle name so each pair has a single canonical entry).
 *
 * Cascade slugs match the FIXTURES labels but URL-style:
 *   root            -> `:root` (default light)
 *   dark            -> `[data-mode='dark']` (default dark)
 *   school-of-rock-light
 *   school-of-rock-dark
 *
 * The shape-redundancy proof, by consumer:
 *
 *   - StatusBadge.tsx carries icon + pill-shape redundancy across all four
 *     state variants:
 *
 *       success: fa-circle-check    rounded-full
 *       warning: fa-triangle-excl   rounded
 *       info:    fa-circle-info     rounded-sm
 *       (no alert variant; alert is rendered by Alert.tsx)
 *
 *   - Alert.tsx carries icon-glyph redundancy across its two state variants:
 *
 *       error:   fa-circle-exclamation
 *       success: fa-circle-check
 *
 *     Both are circles, but the inner glyph differs (`!` vs `check`) — the
 *     same redundancy pattern Bootstrap, Material, and macOS use for
 *     error/success alerts.
 *
 * Adding a waiver: only document a (cascade × pair) that ACTUALLY trips the
 * test today AND has verifiable shape redundancy in real consumers. Don't
 * preemptively waive — that defeats the test.
 *
 * Removing a waiver: when a palette change closes the luminance gap (a
 * theme re-hue that pushes a pair past 1.4x), drop its entry here. The
 * test will then enforce the gap going forward.
 */
const SHAPE_REDUNDANCY_WAIVERS: ReadonlySet<string> = new Set([
  // :root (default light) — all 6 state pairs collapse on bg + border.
  // Default state-bundle palette mirrors the rose / amber / blue / emerald
  // tints that legacy components used inline. The bg's all land around
  // L* 96 (rose-50/amber-100/blue-100/emerald-100), borders around L* 30
  // (rose-800/amber-800/blue-800/emerald-800) — distinctness comes from
  // hue, not luminance. Alert.tsx + StatusBadge.tsx icons + pill shapes
  // carry the CVD fallback.
  'root::alert-warn',
  'root::alert-info',
  'root::alert-success',
  'root::info-warn',
  'root::success-warn',
  'root::info-success',

  // [data-mode='dark'] (default dark) — 3 of 6 pairs fail by both axes:
  //   alert-warn, alert-info, info-warn — saturated -400 stops at similar
  //   lightness on alpha-tinted page bg's at similar lightness.
  // The other 3 pairs pass axis B unwaived:
  //   alert-success (border 1.40), success-warn (bg 1.93), info-success (bg 1.80).
  'dark::alert-warn',
  'dark::alert-info',
  'dark::info-warn',

  // school-of-rock light — 4 of 6 pairs fail. Palette is leather/cream
  // earth tones by design (no blues). Per the precedent in
  // feedback-bundle-hue-separation: info was originally green, re-hued to
  // brown by a11y-lead because success was already green. Pairs that
  // share a bundle with warn (alert-warn, info-warn) pass on the border
  // axis (warn-border #8a5c1f sits darker than the brown info-border and
  // lighter than the red alert-border); the rest collapse.
  'school-of-rock-light::alert-info',
  'school-of-rock-light::alert-success',
  'school-of-rock-light::success-warn',
  'school-of-rock-light::info-success',

  // school-of-rock dark — only info/success fails axis B. The other 5
  // pairs pass via bg or border luminance.
  'school-of-rock-dark::info-success',
]);

const CASCADE_SLUGS: Record<string, string> = {
  ':root': 'root',
  "[data-mode='dark']": 'dark',
  "[data-theme='school-of-rock'][data-mode='light']": 'school-of-rock-light',
  "[data-theme='school-of-rock'][data-mode='dark']": 'school-of-rock-dark',
};

function waiverKey(selector: string, first: Bundle, second: Bundle): string {
  const slug = CASCADE_SLUGS[selector];
  const [low, high] = [first, second].sort();
  return `${slug}::${low}-${high}`;
}

type StatePair = readonly [Bundle, Bundle];

function statePairs(): readonly StatePair[] {
  const pairs: StatePair[] = [];
  for (let outer = 0; outer < STATE_BUNDLES.length; outer += 1) {
    for (let inner = outer + 1; inner < STATE_BUNDLES.length; inner += 1) {
      pairs.push([STATE_BUNDLES[outer], STATE_BUNDLES[inner]]);
    }
  }
  return pairs;
}

describe('bundle CVD-distinguishability (axis B: luminance gap >=1.4x)', () => {
  for (const fixture of FIXTURES) {
    const block = extractBlock(BUNDLES_CSS, fixture.selector);
    const declarations = parseDeclarations(block);

    describe(`${fixture.label}`, () => {
      for (const [first, second] of statePairs()) {
        const firstBgRaw = getSlot(declarations, first, 'bg');
        const secondBgRaw = getSlot(declarations, second, 'bg');
        const firstBorderRaw = getSlot(declarations, first, 'border');
        const secondBorderRaw = getSlot(declarations, second, 'border');

        if (
          firstBgRaw === null ||
          secondBgRaw === null ||
          firstBorderRaw === null ||
          secondBorderRaw === null
        ) {
          continue;
        }

        const firstBg = compositeOverBg(firstBgRaw, fixture.pageBg);
        const secondBg = compositeOverBg(secondBgRaw, fixture.pageBg);
        const firstBorder = resolveFg(firstBorderRaw);
        const secondBorder = resolveFg(secondBorderRaw);

        const bgRatio = luminanceRatio(firstBg, secondBg);
        const borderRatio = luminanceRatio(firstBorder, secondBorder);
        const passesLuminance =
          bgRatio >= LUMINANCE_GAP_THRESHOLD ||
          borderRatio >= LUMINANCE_GAP_THRESHOLD;

        const key = waiverKey(fixture.selector, first, second);
        const waived = SHAPE_REDUNDANCY_WAIVERS.has(key);

        it(`${first}/${second} pair: luminance gap or documented waiver`, () => {
          if (passesLuminance) {
            return;
          }
          expect
            .soft(
              waived,
              `${first}/${second} pair (${fixture.label}): bg ratio ${describeRatio(bgRatio)}, border ratio ${describeRatio(borderRatio)}. Both below ${LUMINANCE_GAP_THRESHOLD}x luminance gap. Verify shape redundancy in consuming components (and add "${key}" to SHAPE_REDUNDANCY_WAIVERS with a citation) OR re-hue one bundle.`,
            )
            .toBe(true);
        });
      }
    });
  }

  /*
   * Stale-waiver guard: every entry in SHAPE_REDUNDANCY_WAIVERS must
   * correspond to a (cascade × pair) that currently fails axis B. If a
   * palette change closes the gap, the waiver becomes a lie — the test
   * would pass either way, so the human reading the waivers list would
   * believe shape redundancy is load-bearing when in fact luminance has
   * taken over. Force the waiver entry to be deleted when no longer needed.
   */
  describe('waiver hygiene', () => {
    it('every documented waiver corresponds to a pair that fails the luminance gap today', () => {
      const reachableFailingKeys = new Set<string>();
      for (const fixture of FIXTURES) {
        const block = extractBlock(BUNDLES_CSS, fixture.selector);
        const declarations = parseDeclarations(block);
        for (const [first, second] of statePairs()) {
          const firstBgRaw = getSlot(declarations, first, 'bg');
          const secondBgRaw = getSlot(declarations, second, 'bg');
          const firstBorderRaw = getSlot(declarations, first, 'border');
          const secondBorderRaw = getSlot(declarations, second, 'border');
          if (
            firstBgRaw === null ||
            secondBgRaw === null ||
            firstBorderRaw === null ||
            secondBorderRaw === null
          ) {
            continue;
          }
          const firstBg = compositeOverBg(firstBgRaw, fixture.pageBg);
          const secondBg = compositeOverBg(secondBgRaw, fixture.pageBg);
          const firstBorder = resolveFg(firstBorderRaw);
          const secondBorder = resolveFg(secondBorderRaw);
          const bgRatio = luminanceRatio(firstBg, secondBg);
          const borderRatio = luminanceRatio(firstBorder, secondBorder);
          if (
            bgRatio < LUMINANCE_GAP_THRESHOLD &&
            borderRatio < LUMINANCE_GAP_THRESHOLD
          ) {
            reachableFailingKeys.add(
              waiverKey(fixture.selector, first, second),
            );
          }
        }
      }

      const stale = [...SHAPE_REDUNDANCY_WAIVERS].filter(
        (key) => !reachableFailingKeys.has(key),
      );
      expect
        .soft(
          stale,
          `Stale waivers (pair now clears ${LUMINANCE_GAP_THRESHOLD}x gap; drop from SHAPE_REDUNDANCY_WAIVERS): ${stale.join(', ')}`,
        )
        .toEqual([]);
    });
  });
});

/*
 * Future work — axis A (CVD-hue distinctness)
 * ===========================================
 *
 * Axis A requires simulating the four CVD types and checking that the
 * a-channel + b-channel directions in L*a*b* projection remain visibly
 * distinct after simulation. Concrete options:
 *
 *   1. Brettel / Vienot / Mollon dichromatic simulation matrices
 *      (https://daltonlens.org/understanding-cvd-simulation/) — three
 *      3x3 matrices in linear-sRGB for protanopia / deuteranopia /
 *      tritanopia, plus a grayscale projection for monochromatism. Pure
 *      math, no dependencies. Pair-distance metric: delta-E 2000 in
 *      L*a*b* after simulation, with a threshold around 10 (JND) or
 *      higher for state-bundle separation.
 *
 *   2. `culori` (npm, MIT) — already-validated CVD simulation + delta-E
 *      under the hood. Trades a runtime dep for less code.
 *
 *   3. `daltonlens-python` reference implementation — port to TS if more
 *      perceptual fidelity is needed than Brettel offers.
 *
 * When axis A lands, the waivers in SHAPE_REDUNDANCY_WAIVERS need to be
 * re-audited: pairs that survive axis A no longer need shape redundancy,
 * even if they fail axis B.
 */
