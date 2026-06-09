/*
 * Bundle CVD-distinguishability contract — automated two-axis check.
 *
 * Encodes feedback-bundle-hue-separation:
 *
 *   Within a single theme, every pair of state bundles (alert / warn /
 *   info / success) MUST be distinguishable on at least one of two axes:
 *
 *     Axis A — hue family that survives all three dichromacy simulations
 *              (protanopia, deuteranopia, tritanopia), measured as delta-E
 *              2000 >= 10 between the simulated bg's OR border's of the
 *              two bundles. Monochromatism is covered by axis B (a
 *              luminance gap large enough to survive grayscale projection).
 *     Axis B — symmetric luminance ratio of >=1.4x between the two bundles'
 *              backgrounds OR their borders.
 *
 *   When neither axis is satisfied, the consuming component MUST carry
 *   redundant non-color signal: distinct icon glyph, prefix label, or
 *   structural marker. Those waivers live in SHAPE_REDUNDANCY_WAIVERS.
 *
 * Sister suite: bundles.contrast.test.ts encodes WCAG SC 1.4.3 + 1.4.11.
 * Shared color parsing, WCAG helpers, and CVD math live in
 * bundles-color-utils.ts.
 *
 * A note on the luminance metric: axis B uses a SYMMETRIC `lighter / darker`
 * ratio (no +0.05 offset). The WCAG +0.05 is calibrated for text/bg
 * legibility, not for surface-vs-surface separability. Two adjacent panels
 * with identical luminance are indistinguishable by luminance alone — ratio
 * 1.0 — which is what we test against.
 *
 * A note on the delta-E threshold: axis A uses delta-E 2000 >= 10. JND
 * (just-noticeable difference) is ~1; "clearly distinct" sits around 3-5;
 * categorical-color CVD palettes commonly require >=10 so two surfaces are
 * UNAMBIGUOUSLY different (not just barely-perceptible) to a viewer with
 * full dichromacy. Sources:
 *   https://colorfyi.com/blog/what-is-delta-e/
 *   https://en.wikipedia.org/wiki/Color_difference#CIEDE2000
 *   https://timbrica.com/en/colorblind-palette (uses dE2000 >= 10 for
 *     CVD-simulated pairs in palette generation).
 *
 * CVD simulation uses the culori library (MIT) — its filterDeficiency{Prot,
 * Deuter, Trit}(1) functions implement validated Brettel/Vienot transforms
 * for full dichromacy. Severity 1 = worst-case (-opia, not -omaly).
 */

import { describe, expect, it } from 'vitest';
import {
  BUNDLES_CSS,
  CVD_TYPES,
  DEFAULT_CSS,
  STATE_BUNDLES,
  compositeOverBg,
  cvdDeltaE,
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
const CVD_DELTA_E_THRESHOLD = 10;

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
const APOLLO_LIGHT_PAGE_BG: Rgb = readPageBg(
  BUNDLES_CSS,
  "[data-theme='apollo-10-1-2'][data-mode='light']",
  'base-bg',
);
const APOLLO_DARK_PAGE_BG: Rgb = readPageBg(
  BUNDLES_CSS,
  "[data-theme='apollo-10-1-2'][data-mode='dark']",
  'base-bg',
);
const BEFORE_MIDNIGHT_LIGHT_PAGE_BG: Rgb = readPageBg(
  BUNDLES_CSS,
  "[data-theme='before-midnight'][data-mode='light']",
  'base-bg',
);
const BEFORE_MIDNIGHT_DARK_PAGE_BG: Rgb = readPageBg(
  BUNDLES_CSS,
  "[data-theme='before-midnight'][data-mode='dark']",
  'base-bg',
);
const BOYHOOD_LIGHT_PAGE_BG: Rgb = readPageBg(
  BUNDLES_CSS,
  "[data-theme='boyhood'][data-mode='light']",
  'base-bg',
);
const BOYHOOD_DARK_PAGE_BG: Rgb = readPageBg(
  BUNDLES_CSS,
  "[data-theme='boyhood'][data-mode='dark']",
  'base-bg',
);
const DAZED_AND_CONFUSED_LIGHT_PAGE_BG: Rgb = readPageBg(
  BUNDLES_CSS,
  "[data-theme='dazed-and-confused'][data-mode='light']",
  'base-bg',
);
const DAZED_AND_CONFUSED_DARK_PAGE_BG: Rgb = readPageBg(
  BUNDLES_CSS,
  "[data-theme='dazed-and-confused'][data-mode='dark']",
  'base-bg',
);
const SCANNER_DARKLY_LIGHT_PAGE_BG: Rgb = readPageBg(
  BUNDLES_CSS,
  "[data-theme='scanner-darkly'][data-mode='light']",
  'base-bg',
);
const SCANNER_DARKLY_DARK_PAGE_BG: Rgb = readPageBg(
  BUNDLES_CSS,
  "[data-theme='scanner-darkly'][data-mode='dark']",
  'base-bg',
);
const HIT_MAN_LIGHT_PAGE_BG: Rgb = readPageBg(
  BUNDLES_CSS,
  "[data-theme='hit-man'][data-mode='light']",
  'base-bg',
);
const HIT_MAN_DARK_PAGE_BG: Rgb = readPageBg(
  BUNDLES_CSS,
  "[data-theme='hit-man'][data-mode='dark']",
  'base-bg',
);
const BEFORE_SUNSET_LIGHT_PAGE_BG: Rgb = readPageBg(
  BUNDLES_CSS,
  "[data-theme='before-sunset'][data-mode='light']",
  'base-bg',
);
const BEFORE_SUNSET_DARK_PAGE_BG: Rgb = readPageBg(
  BUNDLES_CSS,
  "[data-theme='before-sunset'][data-mode='dark']",
  'base-bg',
);
const BEFORE_SUNRISE_LIGHT_PAGE_BG: Rgb = readPageBg(
  BUNDLES_CSS,
  "[data-theme='before-sunrise'][data-mode='light']",
  'base-bg',
);
const BEFORE_SUNRISE_DARK_PAGE_BG: Rgb = readPageBg(
  BUNDLES_CSS,
  "[data-theme='before-sunrise'][data-mode='dark']",
  'base-bg',
);
const NOUVELLE_VAGUE_LIGHT_PAGE_BG: Rgb = readPageBg(
  BUNDLES_CSS,
  "[data-theme='nouvelle-vague'][data-mode='light']",
  'base-bg',
);
const NOUVELLE_VAGUE_DARK_PAGE_BG: Rgb = readPageBg(
  BUNDLES_CSS,
  "[data-theme='nouvelle-vague'][data-mode='dark']",
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
  {
    label: 'apollo-10-1-2 light',
    selector: "[data-theme='apollo-10-1-2'][data-mode='light']",
    pageBg: APOLLO_LIGHT_PAGE_BG,
  },
  {
    label: 'apollo-10-1-2 dark',
    selector: "[data-theme='apollo-10-1-2'][data-mode='dark']",
    pageBg: APOLLO_DARK_PAGE_BG,
  },
  {
    label: 'before-midnight light',
    selector: "[data-theme='before-midnight'][data-mode='light']",
    pageBg: BEFORE_MIDNIGHT_LIGHT_PAGE_BG,
  },
  {
    label: 'before-midnight dark',
    selector: "[data-theme='before-midnight'][data-mode='dark']",
    pageBg: BEFORE_MIDNIGHT_DARK_PAGE_BG,
  },
  {
    label: 'boyhood light',
    selector: "[data-theme='boyhood'][data-mode='light']",
    pageBg: BOYHOOD_LIGHT_PAGE_BG,
  },
  {
    label: 'boyhood dark',
    selector: "[data-theme='boyhood'][data-mode='dark']",
    pageBg: BOYHOOD_DARK_PAGE_BG,
  },
  {
    label: 'dazed-and-confused light',
    selector: "[data-theme='dazed-and-confused'][data-mode='light']",
    pageBg: DAZED_AND_CONFUSED_LIGHT_PAGE_BG,
  },
  {
    label: 'dazed-and-confused dark',
    selector: "[data-theme='dazed-and-confused'][data-mode='dark']",
    pageBg: DAZED_AND_CONFUSED_DARK_PAGE_BG,
  },
  {
    label: 'scanner-darkly light',
    selector: "[data-theme='scanner-darkly'][data-mode='light']",
    pageBg: SCANNER_DARKLY_LIGHT_PAGE_BG,
  },
  {
    label: 'scanner-darkly dark',
    selector: "[data-theme='scanner-darkly'][data-mode='dark']",
    pageBg: SCANNER_DARKLY_DARK_PAGE_BG,
  },
  {
    label: 'hit-man light',
    selector: "[data-theme='hit-man'][data-mode='light']",
    pageBg: HIT_MAN_LIGHT_PAGE_BG,
  },
  {
    label: 'hit-man dark',
    selector: "[data-theme='hit-man'][data-mode='dark']",
    pageBg: HIT_MAN_DARK_PAGE_BG,
  },
  {
    label: 'before-sunset light',
    selector: "[data-theme='before-sunset'][data-mode='light']",
    pageBg: BEFORE_SUNSET_LIGHT_PAGE_BG,
  },
  {
    label: 'before-sunset dark',
    selector: "[data-theme='before-sunset'][data-mode='dark']",
    pageBg: BEFORE_SUNSET_DARK_PAGE_BG,
  },
  {
    label: 'before-sunrise light',
    selector: "[data-theme='before-sunrise'][data-mode='light']",
    pageBg: BEFORE_SUNRISE_LIGHT_PAGE_BG,
  },
  {
    label: 'before-sunrise dark',
    selector: "[data-theme='before-sunrise'][data-mode='dark']",
    pageBg: BEFORE_SUNRISE_DARK_PAGE_BG,
  },
  {
    label: 'nouvelle-vague light',
    selector: "[data-theme='nouvelle-vague'][data-mode='light']",
    pageBg: NOUVELLE_VAGUE_LIGHT_PAGE_BG,
  },
  {
    label: 'nouvelle-vague dark',
    selector: "[data-theme='nouvelle-vague'][data-mode='dark']",
    pageBg: NOUVELLE_VAGUE_DARK_PAGE_BG,
  },
];

/*
 * Documented waivers: cascade-pair combos where consuming components
 * (Alert.tsx + StatusBadge.tsx) carry shape redundancy that satisfies the
 * axis-A/axis-B fallback of feedback-bundle-hue-separation.
 *
 * Each remaining waiver below fails BOTH axes today — verified by the
 * waiver-hygiene meta-test. A pair must collapse on luminance AND collapse
 * under at least one dichromacy to land here.
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
 * Removing a waiver: the waiver-hygiene meta-test auto-detects when a
 * palette change closes either axis, and forces the corresponding entry
 * to be dropped. Don't pre-emptively edit; let the test guide.
 */
const SHAPE_REDUNDANCY_WAIVERS: ReadonlySet<string> = new Set([
  // :root (default light) — 3 warm-vs-warm or red-green pairs survive
  //   axis A pruning from wave 7:
  //   - alert-warn: rose-50/amber-100 bg's collapse under tritanopia
  //     (dE 4.4 bg / 4.2 border, well under 10); rose-800/amber-800
  //     borders are warm-on-warm so luminance gap also collapses.
  //   - alert-success: classic red-green pair; bg's collapse under
  //     deuteranopia (dE 2.5 bg / 9.6 border, just under 10).
  //   - success-warn: emerald vs amber bg's collapse under protanopia
  //     (dE 8.8 bg / 8.0 border, both under 10).
  //   alert-info, info-warn, info-success were waived in wave 6 because
  //   they collapsed on luminance — wave 7's CVD math proves blue stays
  //   distinct from rose/amber/emerald under all three dichromacies, so
  //   those three waivers were dropped.
  'root::alert-warn',
  'root::alert-success',
  'root::success-warn',

  // [data-mode='dark'] (default dark) — 1 warm-vs-warm pair survives.
  //   - alert-warn: rose-400 vs amber-400 borders collapse under tritan
  //     (dE 7.9 border); both bg's are alpha-tinted page bg at similar
  //     lightness so luminance gap also fails.
  //   alert-info and info-warn were waived in wave 6 — wave 7 proves
  //   blue-400 stays distinct from rose-400 / amber-400 under all three
  //   dichromacies, so both waivers were dropped.
  'dark::alert-warn',

  // school-of-rock light — 3 of 4 wave-6 waivers survive. Palette is
  // leather/cream earth tones by design (no blues); info was re-hued to
  // brown because success was originally green (per the school-of-rock
  // re-hue documented in feedback-bundle-hue-separation). Without a
  // blue/cool anchor, three pairs collapse on both axes:
  //   - alert-info: red vs brown bg's are identical (#fadcd6, dE 0);
  //     borders separate barely on protan (dE 14.6) but bg has no signal.
  //     Test passes if EITHER bg or border survives — here only border
  //     does for protan/deuter, and tritan fails outright (border dE 7.5).
  //   - success-warn: cream vs cream bg's (dE 2.4-4.8 across CVDs);
  //     brown vs amber borders survive protan (13.1) but tritan border
  //     also fails (need >=10 under ALL three).
  //   - info-success: brown vs cream bg + brown vs green border; deuter
  //     border 1.86 dE, protan border 5.89 — collapses on both bg and
  //     border under multiple dichromacies.
  //   alert-success was waived in wave 6 — wave 7 proves the red-vs-green
  //   border passes (alert-border #a32010 vs success-border survives
  //   tritan); waiver dropped.
  'school-of-rock-light::alert-info',
  'school-of-rock-light::success-warn',
  'school-of-rock-light::info-success',

  // school-of-rock dark — info vs success collapses under protan
  //   (bg dE 0.6, border dE 3.1) and deuter (border dE 9.7, just under
  //   threshold). The brown vs green pair survives tritan (dE 43.9
  //   border) but axis A requires ALL three. Other 5 pairs pass via
  //   axis A or axis B unwaived.
  'school-of-rock-dark::info-success',

  // nouvelle-vague (light + dark) — grayscale-by-design theme (PRD
  // footnote). The whole palette is true neutrals; axis A is definitionally
  // near-zero (Brettel maps monochromatic → monochromatic) so axis B
  // (luminance ratio) carries every state-pair separation. State pairs
  // that share identical hex values collapse both axes and require shape
  // redundancy from the consuming components:
  //
  //   - Alert.tsx renders `error` with fa-circle-exclamation and `success`
  //     with fa-circle-check unconditionally (not gated by theme). Both
  //     glyphs ship across every theme; nouvelle-vague's wave-16 .tsx
  //     cleanup removes the per-theme branch but the unconditional icon
  //     selection stays — the redundancy citation remains valid.
  //   - Toast.tsx (wave 24) repaints onto the same alert-highlight /
  //     success-highlight slots and reuses the same icon-glyph pair
  //     (fa-circle-exclamation for error variant, fa-circle-check for
  //     success variant). The shape-redundancy proof from Alert.tsx
  //     extends to Toast unchanged.
  //   - StatusBadge.tsx renders `info` with fa-circle-info + rounded-sm
  //     pill shape, `warning` with fa-triangle-exclamation + rounded pill,
  //     and `success` with fa-circle-check + rounded-full pill. All three
  //     shape/icon combinations are unconditional, so the info-warn
  //     redundancy holds across every theme including nouvelle-vague.
  //
  // Three pairs land here (matches the brief's pre-flight estimate, well
  // under the 8-12 hedge band):
  //   light: alert-success — alert/success share #393939 border and #1a1a1a
  //          highlight by design (no available darker neutral that clears
  //          WCAG against the bundle bg #ebebeb).
  //   dark:  alert-success — alert/success share #aaaaaa border by design
  //          (no available lighter neutral that clears WCAG against the
  //          composited dark bundle bg).
  //   dark:  info-warn      — info/warn share #878787 border by design.
  //
  // The unwaived light pairs separate via axis B alone:
  //   alert/warn       border lum 2.22x (#393939 vs #555555)
  //   alert/info       border lum 3.59x (#393939 vs #6b6b6b)
  //   warn/info        border lum 1.62x (#555555 vs #6b6b6b — brief flagged
  //                    as razor 1.41 +0.01, verified 1.62, M-L1 NOT applied)
  //   warn/success     border lum 2.22x (#555555 vs #393939)
  //   info/success     border lum 3.59x (#6b6b6b vs #393939)
  // The unwaived dark pairs each clear axis B at 1.66x via the
  // #aaaaaa-vs-#878787 border split.
  'nouvelle-vague-light::alert-success',
  'nouvelle-vague-dark::alert-success',
  'nouvelle-vague-dark::info-warn',
]);

const CASCADE_SLUGS: Record<string, string> = {
  ':root': 'root',
  "[data-mode='dark']": 'dark',
  "[data-theme='school-of-rock'][data-mode='light']": 'school-of-rock-light',
  "[data-theme='school-of-rock'][data-mode='dark']": 'school-of-rock-dark',
  "[data-theme='apollo-10-1-2'][data-mode='light']": 'apollo-10-1-2-light',
  "[data-theme='apollo-10-1-2'][data-mode='dark']": 'apollo-10-1-2-dark',
  "[data-theme='before-midnight'][data-mode='light']": 'before-midnight-light',
  "[data-theme='before-midnight'][data-mode='dark']": 'before-midnight-dark',
  "[data-theme='boyhood'][data-mode='light']": 'boyhood-light',
  "[data-theme='boyhood'][data-mode='dark']": 'boyhood-dark',
  "[data-theme='dazed-and-confused'][data-mode='light']":
    'dazed-and-confused-light',
  "[data-theme='dazed-and-confused'][data-mode='dark']":
    'dazed-and-confused-dark',
  "[data-theme='scanner-darkly'][data-mode='light']": 'scanner-darkly-light',
  "[data-theme='scanner-darkly'][data-mode='dark']": 'scanner-darkly-dark',
  "[data-theme='hit-man'][data-mode='light']": 'hit-man-light',
  "[data-theme='hit-man'][data-mode='dark']": 'hit-man-dark',
  "[data-theme='before-sunset'][data-mode='light']": 'before-sunset-light',
  "[data-theme='before-sunset'][data-mode='dark']": 'before-sunset-dark',
  "[data-theme='before-sunrise'][data-mode='light']": 'before-sunrise-light',
  "[data-theme='before-sunrise'][data-mode='dark']": 'before-sunrise-dark',
  "[data-theme='nouvelle-vague'][data-mode='light']": 'nouvelle-vague-light',
  "[data-theme='nouvelle-vague'][data-mode='dark']": 'nouvelle-vague-dark',
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

interface PairColors {
  readonly firstBg: Rgb;
  readonly secondBg: Rgb;
  readonly firstBorder: Rgb;
  readonly secondBorder: Rgb;
}

function resolvePairColors(
  declarations: Map<string, string>,
  pageBg: Rgb,
  first: Bundle,
  second: Bundle,
): PairColors | null {
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
    return null;
  }
  return {
    firstBg: compositeOverBg(firstBgRaw, pageBg),
    secondBg: compositeOverBg(secondBgRaw, pageBg),
    firstBorder: resolveFg(firstBorderRaw),
    secondBorder: resolveFg(secondBorderRaw),
  };
}

interface PairDistinguishability {
  readonly bgLuminanceRatio: number;
  readonly borderLuminanceRatio: number;
  readonly passesAxisB: boolean;
  readonly cvdDeltaEs: Readonly<
    Record<(typeof CVD_TYPES)[number], { bg: number; border: number }>
  >;
  readonly passesAxisA: boolean;
}

function evaluatePair(colors: PairColors): PairDistinguishability {
  const bgLuminanceRatio = luminanceRatio(colors.firstBg, colors.secondBg);
  const borderLuminanceRatio = luminanceRatio(
    colors.firstBorder,
    colors.secondBorder,
  );
  const passesAxisB =
    bgLuminanceRatio >= LUMINANCE_GAP_THRESHOLD ||
    borderLuminanceRatio >= LUMINANCE_GAP_THRESHOLD;

  const cvdDeltaEs = Object.fromEntries(
    CVD_TYPES.map((cvd) => [
      cvd,
      {
        bg: cvdDeltaE(colors.firstBg, colors.secondBg, cvd),
        border: cvdDeltaE(colors.firstBorder, colors.secondBorder, cvd),
      },
    ]),
  ) as PairDistinguishability['cvdDeltaEs'];

  /*
   * Pair survives a single CVD type if EITHER bg or border stays distinct
   * after simulation — mirrors axis B's "bg OR border" disjunction. Pair
   * passes axis A only if it survives ALL three dichromacies.
   */
  const passesAxisA = CVD_TYPES.every(
    (cvd) =>
      cvdDeltaEs[cvd].bg >= CVD_DELTA_E_THRESHOLD ||
      cvdDeltaEs[cvd].border >= CVD_DELTA_E_THRESHOLD,
  );

  return {
    bgLuminanceRatio,
    borderLuminanceRatio,
    passesAxisB,
    cvdDeltaEs,
    passesAxisA,
  };
}

function describePairFailure(
  result: PairDistinguishability,
  first: Bundle,
  second: Bundle,
  fixtureLabel: string,
  key: string,
): string {
  const cvdSummary = CVD_TYPES.map((cvd) => {
    const { bg, border } = result.cvdDeltaEs[cvd];
    return `${cvd} dE bg ${bg.toFixed(1)} / border ${border.toFixed(1)}`;
  }).join('; ');
  return (
    `${first}/${second} pair (${fixtureLabel}): ` +
    `axis B bg ${describeRatio(result.bgLuminanceRatio)}, border ${describeRatio(result.borderLuminanceRatio)} (need >=${LUMINANCE_GAP_THRESHOLD}x); ` +
    `axis A ${cvdSummary} (need >=${CVD_DELTA_E_THRESHOLD} under all three). ` +
    `Both axes fail. ` +
    `Verify shape redundancy in consuming components (and add "${key}" to SHAPE_REDUNDANCY_WAIVERS with a citation) OR re-hue one bundle.`
  );
}

describe('bundle CVD-distinguishability (axis A: CVD-simulated dE2000 >=10; axis B: luminance gap >=1.4x)', () => {
  for (const fixture of FIXTURES) {
    const block = extractBlock(BUNDLES_CSS, fixture.selector);
    const declarations = parseDeclarations(block);

    describe(`${fixture.label}`, () => {
      for (const [first, second] of statePairs()) {
        const colors = resolvePairColors(
          declarations,
          fixture.pageBg,
          first,
          second,
        );
        if (colors === null) {
          continue;
        }

        const result = evaluatePair(colors);
        const key = waiverKey(fixture.selector, first, second);
        const waived = SHAPE_REDUNDANCY_WAIVERS.has(key);

        it(`${first}/${second} pair: axis A, axis B, or documented waiver`, () => {
          if (result.passesAxisA || result.passesAxisB) {
            return;
          }
          expect
            .soft(
              waived,
              describePairFailure(result, first, second, fixture.label, key),
            )
            .toBe(true);
        });
      }
    });
  }

  /*
   * Stale-waiver guard: every entry in SHAPE_REDUNDANCY_WAIVERS must
   * correspond to a (cascade × pair) that currently fails BOTH axes. If
   * a palette change closes a gap on either axis, the waiver becomes a
   * lie — the test would pass either way, so a human reading the waivers
   * list would believe shape redundancy is load-bearing when in fact
   * luminance or hue separation has taken over. Force the waiver entry
   * to be deleted when no longer needed.
   */
  describe('waiver hygiene', () => {
    it('every documented waiver corresponds to a pair that fails both axes today', () => {
      const reachableFailingKeys = new Set<string>();
      for (const fixture of FIXTURES) {
        const block = extractBlock(BUNDLES_CSS, fixture.selector);
        const declarations = parseDeclarations(block);
        for (const [first, second] of statePairs()) {
          const colors = resolvePairColors(
            declarations,
            fixture.pageBg,
            first,
            second,
          );
          if (colors === null) {
            continue;
          }
          const result = evaluatePair(colors);
          if (!result.passesAxisA && !result.passesAxisB) {
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
          `Stale waivers (pair now passes axis A or axis B; drop from SHAPE_REDUNDANCY_WAIVERS): ${stale.join(', ')}`,
        )
        .toEqual([]);
    });
  });
});
