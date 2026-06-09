/*
 * Bundle contrast contract — automated WCAG verification.
 *
 * Parses bundles.css and asserts every bundle pair clears the threshold
 * documented in the file's preamble (lines 1-44):
 *
 *     text/bg, alt-text/bg                       >= 4.5:1   (SC 1.4.3)
 *     border/bg, highlight/bg                    >= 3:1     (SC 1.4.11)
 *     highlight-fg/highlight,
 *     highlight-fg/highlight-hover               >= 4.5:1   (SC 1.4.3)
 *
 * Card-style bundles (mount/orbit/alert/warn/info/success) additionally
 * clear 3:1 between their border and the PAGE --base-bg.
 *
 * Why this file exists: waves 1-4 of the bundle migration verified ratios
 * by hand. Future waves cannot scale that. This suite encodes the contract
 * so any regression — a hex tweak that drops below the threshold, a
 * forgotten composite, a typo in an alpha value — surfaces in CI.
 *
 * Apollo migrated to the bundle cascade in wave 8 (CVD-mandated palette
 * verified per-pair against axis A + axis B distinguishability) and is
 * covered by its own FIXTURES entries below.
 *
 * Nouvelle Vague migrated in wave 16 (final). The palette is grayscale
 * by design, so categorical separation between state bundles is carried
 * by axis B (luminance ratio) plus three SHAPE_REDUNDANCY_WAIVERS entries
 * documented in the sister suite — see bundles.distinguishability.test.ts.
 *
 * Soft assertions are used so a single run reports every failing pair,
 * not just the first.
 *
 * Sister suite: bundles.distinguishability.test.ts encodes the
 * CVD-distinguishability invariant from feedback-bundle-hue-separation.
 * Shared color parsing + WCAG helpers live in bundles-color-utils.ts.
 */

import { describe, expect, it } from 'vitest';
import {
  BUNDLES,
  BUNDLES_CSS,
  CARD_BUNDLES,
  DEFAULT_CSS,
  bundleIsFullyDefined,
  compositeOverBg,
  contrastRatio,
  describeRatio,
  extractBlock,
  getSlot,
  parseColor,
  parseDeclarations,
  readPageBg,
  resolveFg,
} from './bundles-color-utils';
import type { Rgb, Slot } from './bundles-color-utils';

const AA_NORMAL = 4.5;
const AA_NON_TEXT = 3;

interface ContractPair {
  readonly fg: Slot;
  readonly bg: Slot;
  readonly threshold: number;
}

const CONTRACT: readonly ContractPair[] = [
  { fg: 'text', bg: 'bg', threshold: AA_NORMAL },
  { fg: 'alt-text', bg: 'bg', threshold: AA_NORMAL },
  { fg: 'border', bg: 'bg', threshold: AA_NON_TEXT },
  { fg: 'highlight', bg: 'bg', threshold: AA_NON_TEXT },
  { fg: 'highlight-fg', bg: 'highlight', threshold: AA_NORMAL },
  { fg: 'highlight-fg', bg: 'highlight-hover', threshold: AA_NORMAL },
];

interface CascadeFixture {
  readonly label: string;
  readonly selector: string;
  /*
   * Page background to composite alpha bundle-bgs over. For the default
   * cascade this is the default theme's `:root --bg`. For school-of-rock,
   * it's the cascade's own --base-bg.
   */
  readonly pageBg: Rgb;
  /*
   * Whether to run the border-vs-page-bg adjacency check. Only set when
   * the cascade self-contains a concrete --base-bg. The default cascade
   * aliases --base-bg to `var(--bg)`, so adjacency is theme-dependent and
   * verified separately in code review (see bundles.css preamble notes
   * on cross-theme worst-case verification).
   */
  readonly checkAdjacency: boolean;
}

/*
 * Default cascade (`:root`, `[data-mode='dark']`) does not redefine
 * --base-bg — the bundles cascade aliases it to `var(--bg)`. So the
 * page background for the default cascade comes from default.css's
 * `:root --bg`. (The default theme's --bg is the same regardless of
 * mode — `[data-mode='dark']` overrides only the state bundles.)
 * The school-of-rock cascade defines --base-bg directly as hex, so
 * we can read it straight out of bundles.css.
 *
 * The default cascade also paints under every un-migrated theme (any
 * theme that has not redefined its bundle palette). The un-migrated
 * theme's --bg becomes the page background under the default cascade's
 * bundle-borders. We hardcode the worst-case un-migrated --bg values
 * below so the default-cascade border tokens can be validated against
 * every un-migrated theme they will ever paint under. See
 * `cross-theme border vs un-migrated theme --bg` block.
 */
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
    checkAdjacency: false,
  },
  {
    label: "[data-mode='dark'] (default dark state bundles)",
    selector: "[data-mode='dark']",
    pageBg: DEFAULT_PAGE_BG,
    checkAdjacency: false,
  },
  {
    label: 'school-of-rock light',
    selector: "[data-theme='school-of-rock'][data-mode='light']",
    pageBg: SCHOOL_OF_ROCK_LIGHT_PAGE_BG,
    checkAdjacency: true,
  },
  {
    label: 'school-of-rock dark',
    selector: "[data-theme='school-of-rock'][data-mode='dark']",
    pageBg: SCHOOL_OF_ROCK_DARK_PAGE_BG,
    checkAdjacency: true,
  },
  {
    label: 'apollo-10-1-2 light',
    selector: "[data-theme='apollo-10-1-2'][data-mode='light']",
    pageBg: APOLLO_LIGHT_PAGE_BG,
    checkAdjacency: true,
  },
  {
    label: 'apollo-10-1-2 dark',
    selector: "[data-theme='apollo-10-1-2'][data-mode='dark']",
    pageBg: APOLLO_DARK_PAGE_BG,
    checkAdjacency: true,
  },
  {
    label: 'before-midnight light',
    selector: "[data-theme='before-midnight'][data-mode='light']",
    pageBg: BEFORE_MIDNIGHT_LIGHT_PAGE_BG,
    checkAdjacency: true,
  },
  {
    label: 'before-midnight dark',
    selector: "[data-theme='before-midnight'][data-mode='dark']",
    pageBg: BEFORE_MIDNIGHT_DARK_PAGE_BG,
    checkAdjacency: true,
  },
  {
    label: 'boyhood light',
    selector: "[data-theme='boyhood'][data-mode='light']",
    pageBg: BOYHOOD_LIGHT_PAGE_BG,
    checkAdjacency: true,
  },
  {
    label: 'boyhood dark',
    selector: "[data-theme='boyhood'][data-mode='dark']",
    pageBg: BOYHOOD_DARK_PAGE_BG,
    checkAdjacency: true,
  },
  {
    label: 'dazed-and-confused light',
    selector: "[data-theme='dazed-and-confused'][data-mode='light']",
    pageBg: DAZED_AND_CONFUSED_LIGHT_PAGE_BG,
    checkAdjacency: true,
  },
  {
    label: 'dazed-and-confused dark',
    selector: "[data-theme='dazed-and-confused'][data-mode='dark']",
    pageBg: DAZED_AND_CONFUSED_DARK_PAGE_BG,
    checkAdjacency: true,
  },
  {
    label: 'scanner-darkly light',
    selector: "[data-theme='scanner-darkly'][data-mode='light']",
    pageBg: SCANNER_DARKLY_LIGHT_PAGE_BG,
    checkAdjacency: true,
  },
  {
    label: 'scanner-darkly dark',
    selector: "[data-theme='scanner-darkly'][data-mode='dark']",
    pageBg: SCANNER_DARKLY_DARK_PAGE_BG,
    checkAdjacency: true,
  },
  {
    label: 'hit-man light',
    selector: "[data-theme='hit-man'][data-mode='light']",
    pageBg: HIT_MAN_LIGHT_PAGE_BG,
    checkAdjacency: true,
  },
  {
    label: 'hit-man dark',
    selector: "[data-theme='hit-man'][data-mode='dark']",
    pageBg: HIT_MAN_DARK_PAGE_BG,
    checkAdjacency: true,
  },
  {
    label: 'before-sunset light',
    selector: "[data-theme='before-sunset'][data-mode='light']",
    pageBg: BEFORE_SUNSET_LIGHT_PAGE_BG,
    checkAdjacency: true,
  },
  {
    label: 'before-sunset dark',
    selector: "[data-theme='before-sunset'][data-mode='dark']",
    pageBg: BEFORE_SUNSET_DARK_PAGE_BG,
    checkAdjacency: true,
  },
  {
    label: 'before-sunrise light',
    selector: "[data-theme='before-sunrise'][data-mode='light']",
    pageBg: BEFORE_SUNRISE_LIGHT_PAGE_BG,
    checkAdjacency: true,
  },
  {
    label: 'before-sunrise dark',
    selector: "[data-theme='before-sunrise'][data-mode='dark']",
    pageBg: BEFORE_SUNRISE_DARK_PAGE_BG,
    checkAdjacency: true,
  },
  {
    label: 'nouvelle-vague light',
    selector: "[data-theme='nouvelle-vague'][data-mode='light']",
    pageBg: NOUVELLE_VAGUE_LIGHT_PAGE_BG,
    checkAdjacency: true,
  },
  {
    label: 'nouvelle-vague dark',
    selector: "[data-theme='nouvelle-vague'][data-mode='dark']",
    pageBg: NOUVELLE_VAGUE_DARK_PAGE_BG,
    checkAdjacency: true,
  },
];

/*
 * Worst-case un-migrated theme --bg values for cross-theme adjacency.
 *
 * Used to validate the default cascade's --{bundle}-border clears 3:1
 * (SC 1.4.11) against every un-migrated theme it will paint under.
 *
 * Hardcoded rather than read from each theme stylesheet so the test
 * file documents the contract explicitly: "these are the eight page
 * backgrounds the default-cascade bundle-borders must clear." If a new
 * theme lands, add it here. If a theme is migrated to its own bundle
 * palette, remove it (its own cascade will be covered by FIXTURES).
 *
 * Apollo + Nouvelle Vague are intentionally excluded: both have their
 * own per-theme bundle cascades (covered by FIXTURES). After the wave-16
 * nouvelle-vague migration, every shipped theme has its own cascade —
 * only `default` remains in the un-migrated dark map (and the un-migrated
 * light map is empty).
 */
const UN_MIGRATED_LIGHT_BGS: Record<string, string> = {};

const UN_MIGRATED_DARK_BGS: Record<string, string> = {
  default: '#0f0b1b',
};

describe('bundle contrast contract', () => {
  for (const fixture of FIXTURES) {
    const block = extractBlock(BUNDLES_CSS, fixture.selector);
    const declarations = parseDeclarations(block);

    describe(`${fixture.label}`, () => {
      for (const bundle of BUNDLES) {
        if (!bundleIsFullyDefined(declarations, bundle)) {
          continue;
        }

        describe(`${bundle} bundle`, () => {
          for (const pair of CONTRACT) {
            it(`${pair.fg} on ${pair.bg} >= ${pair.threshold}:1`, () => {
              const foregroundRaw = getSlot(declarations, bundle, pair.fg);
              const backgroundRaw = getSlot(declarations, bundle, pair.bg);
              if (foregroundRaw === null || backgroundRaw === null) {
                throw new Error(
                  `Missing slot for ${bundle}-${pair.fg} / ${bundle}-${pair.bg}`,
                );
              }
              const background = compositeOverBg(backgroundRaw, fixture.pageBg);
              const foreground = resolveFg(foregroundRaw);
              const ratio = contrastRatio(foreground, background);
              expect
                .soft(
                  ratio,
                  `${bundle}-${pair.fg} on ${bundle}-${pair.bg} (${fixture.label}): got ${describeRatio(ratio)}`,
                )
                .toBeGreaterThanOrEqual(pair.threshold);
            });
          }
        });
      }
    });
  }

  /*
   * --base-subtle-text is a BASE-only slot (no equivalent on mount/orbit/
   * state bundles). It expresses the lowest-emphasis text tier used by
   * page-chrome consumers — kbd legends, helper hints, chevrons, the
   * descriptive line under section nav pills. Contract: clears 4.5:1
   * against --base-bg per SC 1.4.3.
   *
   * Lives outside the CONTRACT iteration above because that loop applies
   * the same slot set to all 7 bundles; introducing a base-only slot
   * cannot use that shape. See wave 19 brief Q1.
   */
  describe('base-subtle-text on base-bg', () => {
    for (const fixture of FIXTURES) {
      const block = extractBlock(BUNDLES_CSS, fixture.selector);
      const declarations = parseDeclarations(block);
      const subtleText = declarations.get('base-subtle-text');
      const baseBg = declarations.get('base-bg');
      if (subtleText === undefined || baseBg === undefined) {
        continue;
      }
      if (subtleText.includes('var(') || baseBg.includes('var(')) {
        continue;
      }

      it(`${fixture.label} >= 4.5:1`, () => {
        const foreground = resolveFg(parseColor(subtleText));
        const background = compositeOverBg(parseColor(baseBg), fixture.pageBg);
        const ratio = contrastRatio(foreground, background);
        expect
          .soft(
            ratio,
            `base-subtle-text on base-bg (${fixture.label}): got ${describeRatio(ratio)}`,
          )
          .toBeGreaterThanOrEqual(AA_NORMAL);
      });
    }
  });

  describe('card-style border vs page --base-bg', () => {
    for (const fixture of FIXTURES) {
      if (!fixture.checkAdjacency) {
        continue;
      }
      const block = extractBlock(BUNDLES_CSS, fixture.selector);
      const declarations = parseDeclarations(block);

      describe(`${fixture.label}`, () => {
        for (const bundle of CARD_BUNDLES) {
          const border = getSlot(declarations, bundle, 'border');
          if (border === null) {
            continue;
          }

          it(`${bundle}-border on page --base-bg >= 3:1`, () => {
            const ratio = contrastRatio(resolveFg(border), fixture.pageBg);
            expect
              .soft(
                ratio,
                `${bundle}-border on page --base-bg (${fixture.label}): got ${describeRatio(ratio)}`,
              )
              .toBeGreaterThanOrEqual(AA_NON_TEXT);
          });
        }
      });
    }
  });

  /*
   * Cross-theme adjacency for the default cascade.
   *
   * The default cascade aliases --base-bg to var(--bg), which means the
   * actual page background under default-cascade bundle-borders is
   * whichever un-migrated theme is active. The fixture-based adjacency
   * check above cannot validate this — it only runs against cascades
   * that self-contain a concrete --base-bg.
   *
   * This block closes that gap: for every (bundle, un-migrated theme)
   * pair, assert the default-cascade --{bundle}-border clears 3:1
   * against that theme's --bg.
   *
   * This is the check that catches "wave 2's hardened-default border
   * passes against the default theme's --bg but silently fails against
   * `before-midnight` light" — i.e. the wave-5 success-border defect.
   */
  describe('cross-theme: default-cascade border vs un-migrated theme --bg', () => {
    const lightBlock = extractBlock(BUNDLES_CSS, ':root');
    const lightDeclarations = parseDeclarations(lightBlock);
    const darkBlock = extractBlock(BUNDLES_CSS, "[data-mode='dark']");
    const darkDeclarations = parseDeclarations(darkBlock);

    /*
     * Guard each cross-theme describe block on the corresponding UN_MIGRATED
     * map being non-empty. When the last un-migrated theme in a mode is
     * migrated to its own bundle cascade (covered by FIXTURES above), the
     * map empties out and this block would otherwise register a parent
     * describe with no `it` children — vitest treats that as a failure.
     * Skip the whole sub-suite when there's nothing left to check.
     */
    if (Object.keys(UN_MIGRATED_LIGHT_BGS).length > 0) {
      describe(':root (light) borders', () => {
        for (const bundle of CARD_BUNDLES) {
          const border = getSlot(lightDeclarations, bundle, 'border');
          if (border === null) {
            continue;
          }

          for (const [theme, bg] of Object.entries(UN_MIGRATED_LIGHT_BGS)) {
            const pageBg = resolveFg(parseColor(bg));

            it(`${bundle}-border on ${theme} --bg #${bg.slice(1)} >= 3:1`, () => {
              const ratio = contrastRatio(resolveFg(border), pageBg);
              expect
                .soft(
                  ratio,
                  `${bundle}-border on ${theme} light --bg ${bg}: got ${describeRatio(ratio)}`,
                )
                .toBeGreaterThanOrEqual(AA_NON_TEXT);
            });
          }
        }
      });
    }

    if (Object.keys(UN_MIGRATED_DARK_BGS).length > 0) {
      describe("[data-mode='dark'] borders", () => {
        for (const bundle of CARD_BUNDLES) {
          const border = getSlot(darkDeclarations, bundle, 'border');
          if (border === null) {
            continue;
          }

          for (const [theme, bg] of Object.entries(UN_MIGRATED_DARK_BGS)) {
            const pageBg = resolveFg(parseColor(bg));
            /*
             * Dark-mode bundle bgs are alpha-on-page (e.g.
             * `rgb(76 5 25 / 0.4)`). The card-border itself is opaque, so
             * the page-bg adjacency check uses the raw theme --bg with no
             * composite — the border sits on top of the page surface, not
             * the bundle bg.
             */

            it(`${bundle}-border on ${theme} dark --bg #${bg.slice(1)} >= 3:1`, () => {
              const ratio = contrastRatio(resolveFg(border), pageBg);
              expect
                .soft(
                  ratio,
                  `${bundle}-border on ${theme} dark --bg ${bg}: got ${describeRatio(ratio)}`,
                )
                .toBeGreaterThanOrEqual(AA_NON_TEXT);
            });
          }
        }
      });
    }
  });
});
