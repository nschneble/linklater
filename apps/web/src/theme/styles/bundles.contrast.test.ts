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
 * Apollo + Nouvelle Vague are intentionally excluded: they predate the
 * bundle contract and still use legacy --state-* tokens / bespoke
 * grayscale. They will be folded in when their CVD-aware bundle palettes
 * land (see PR #24 deferred list).
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
 * Apollo + Nouvelle Vague are intentionally excluded (see top-of-file
 * preamble): they predate the bundle contract and still use legacy
 * --state-* tokens, so the default cascade never paints under them.
 */
const UN_MIGRATED_LIGHT_BGS: Record<string, string> = {
  boyhood: '#d0cf93',
  'hit-man': '#f0c870',
  'dazed-and-confused': '#f3f0ed',
  'before-sunrise': '#f3ecd3',
  'before-sunset': '#e8e5d7',
  'before-midnight': '#ccc095',
  'scanner-darkly': '#eeeedf',
};

const UN_MIGRATED_DARK_BGS: Record<string, string> = {
  default: '#0f0b1b',
  boyhood: '#0d150d',
  'hit-man': '#1a150e',
  'before-sunset': '#050404',
  'before-sunrise': '#3c1e0e',
  'before-midnight': '#1c2c38',
  'dazed-and-confused': '#2a201d',
  'scanner-darkly': '#0f0b1b',
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
  });
});
