/*
 * Bundle contrast contract — automated WCAG verification.
 *
 * Parses bundles.css and asserts every bundle pair clears the threshold
 * documented in the file's preamble:
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
  bundleIsFullyDefined,
  compositeOverBg,
  contrastRatio,
  describeRatio,
  extractBlock,
  getSlot,
  luminanceRatio,
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
   * cascade this is `bundles.css :root --base-bg`. For each per-theme
   * cascade, it's the cascade's own --base-bg.
   */
  readonly pageBg: Rgb;
  /*
   * Whether to run the border-vs-page-bg adjacency check. False for the
   * `:root` + `[data-mode='dark']` defensive defaults (no runtime
   * consumer paints them — all 10 themes have per-theme cascades).
   * True for every per-theme fixture, which self-contains a concrete
   * --base-bg.
   */
  readonly checkAdjacency: boolean;
}

/*
 * Default cascade (`:root`, `[data-mode='dark']`) pins --base-bg to an
 * explicit hex in `bundles.css :root` (wave 36 retired the legacy
 * `--bg` flat-token alias). The default cascade's state-bundle borders
 * are pure defensive fallback now that all 10 shipped themes carry
 * their own per-theme bundle cascades — `checkAdjacency: false` skips
 * the border adjacency assertions for `:root` + `[data-mode='dark']`
 * since no runtime consumer paints the default cascade's state
 * borders. Per-theme cascades define --base-bg directly as hex; we
 * read it from the per-theme `.css` files via the concatenated
 * `BUNDLES_CSS` source for each FIXTURES entry.
 */
const DEFAULT_PAGE_BG: Rgb = readPageBg(BUNDLES_CSS, ':root', 'base-bg');
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
   * --focus-ring is a UNIVERSAL chrome token (not a per-bundle slot).
   * SC 1.4.11 requires the focus indicator clear 3:1 against every
   * surface a focused element can sit on: base-bg, mount-bg, orbit-bg,
   * and each state bundle's composited bg. Mechanizes the wave 21
   * contract that the brief verified by hand.
   *
   * Every per-theme cascade ships an explicit `--focus-ring: #...` hex
   * (wave 43). The `:root` synthetic fallback in `bundles.css` omits
   * the slot (wave 44 retirement of `--accent` collapsed the prior
   * alias chain) — the resolver returns null for that fixture so the
   * per-theme cascades carry the contract.
   */
  describe('focus-ring on every surface', () => {
    const SURFACES_TO_CHECK = [
      'base-bg',
      'mount-bg',
      'orbit-bg',
      'alert-bg',
      'warn-bg',
      'info-bg',
      'success-bg',
    ] as const;

    /*
     * Resolve `--focus-ring` to a literal hex.
     *
     * Legitimate shapes today:
     *  1. Undefined (no `--focus-ring` declared in this fixture's block) —
     *     return null so the caller can skip the fixture cleanly. The
     *     synthetic `:root` / `[data-mode='dark']` cascades omit the
     *     slot post-wave-44 (the prior `var(--accent)` alias chain was
     *     retired). Only per-theme blocks declare it.
     *  2. Literal hex (every per-theme block post-wave-43). This is the
     *     only resolved path today.
     *
     * Wave 44 retired the `var(--accent)` alias chase that previously
     * lived here — the resolver's state space collapsed to undefined →
     * null and hex → hex. Anything else (an unexpected alias, a
     * misspelled function) gets returned as `'__UNRESOLVED__'` so the
     * caller can fail loud rather than silently skip the fixture and
     * lose coverage. See a11y-lead MINOR in wave 23.1 gang findings —
     * silent-skip on aliases was the bug.
     */
    function resolveFocusRing(
      declarations: Map<string, string>,
    ): string | null {
      const value = declarations.get('focus-ring');
      if (value === undefined) {
        return null;
      }
      if (value.startsWith('#')) {
        return value;
      }
      return '__UNRESOLVED__';
    }

    for (const fixture of FIXTURES) {
      const block = extractBlock(BUNDLES_CSS, fixture.selector);
      const declarations = parseDeclarations(block);
      const focusRing = resolveFocusRing(declarations);
      if (focusRing === null) {
        continue;
      }

      describe(`${fixture.label}`, () => {
        if (focusRing === '__UNRESOLVED__') {
          // Fail loud per a11y-lead MINOR — silent skip would mask a
          // future alias the resolver does not know how to chase.
          const raw = declarations.get('focus-ring') ?? '<undeclared>';
          it(`focus-ring resolves to a hex literal`, () => {
            expect.fail(
              `Could not resolve --focus-ring (${raw}) for ${fixture.label}. ` +
                `Either extend resolveFocusRing to chase the new alias or ` +
                `inline a hex value in the cascade block.`,
            );
          });
          return;
        }
        for (const surface of SURFACES_TO_CHECK) {
          const surfaceRaw = declarations.get(surface);
          if (surfaceRaw === undefined || surfaceRaw.includes('var(')) {
            continue;
          }

          it(`focus-ring on ${surface} >= 3:1`, () => {
            const foreground = resolveFg(parseColor(focusRing));
            const background = compositeOverBg(
              parseColor(surfaceRaw),
              fixture.pageBg,
            );
            const ratio = contrastRatio(foreground, background);
            expect
              .soft(
                ratio,
                `focus-ring on ${surface} (${fixture.label}): got ${describeRatio(ratio)}`,
              )
              .toBeGreaterThanOrEqual(AA_NON_TEXT);
          });
        }
      });
    }
  });

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

  /*
   * State-bundle text rendered DIRECTLY on the page background (no
   * `--{state}-bg` wrapper). Real consumer: AppShell warn banner text
   * fallback under specific media queries. The text/bg-in-bundle contract
   * above covers `--alert-text` over `--alert-bg`; this block covers
   * `--alert-text` over `--base-bg` which has no equivalent in the
   * per-bundle CONTRACT iteration.
   *
   * Pattern is monotonically safer than text-on-bundle-bg because state
   * bgs sit at the lightness extreme adjacent to `--base-bg`, but a hex
   * tweak to either token could silently regress without mechanization.
   * See [[feedback-state-text-on-base-bg-test-pair]].
   */
  describe('state-text on base-bg', () => {
    for (const fixture of FIXTURES) {
      if (!fixture.checkAdjacency) {
        continue;
      }
      const block = extractBlock(BUNDLES_CSS, fixture.selector);
      const declarations = parseDeclarations(block);
      const baseBg = declarations.get('base-bg');
      if (baseBg === undefined || baseBg.includes('var(')) {
        continue;
      }

      describe(`${fixture.label}`, () => {
        for (const bundle of ['alert', 'warn', 'info', 'success'] as const) {
          const stateText = declarations.get(`${bundle}-text`);
          if (stateText === undefined || stateText.includes('var(')) {
            continue;
          }

          it(`${bundle}-text on base-bg >= 4.5:1`, () => {
            const foreground = resolveFg(parseColor(stateText));
            const background = compositeOverBg(
              parseColor(baseBg),
              fixture.pageBg,
            );
            const ratio = contrastRatio(foreground, background);
            expect
              .soft(
                ratio,
                `${bundle}-text on base-bg (${fixture.label}): got ${describeRatio(ratio)}`,
              )
              .toBeGreaterThanOrEqual(AA_NORMAL);
          });
        }
      });
    }
  });

  /*
   * --base-input-bg and --mount-input-bg are base/mount-only slots
   * tuning the form-input fill per host surface. Wave 22a added the
   * slots + mount-input-bg per-theme values (consumed by ColorEditor).
   * Wave 22b added per-theme --base-input-bg values + migrated
   * FormInput / LinksToolbar / 11 indirect consumers. Wave 23 retired
   * the legacy --bg-input flat token and dropped the default-cascade
   * aliases from bundles.css :root.
   *
   * Contract per slot:
   *   {surface}-text on {surface}-input-bg          >= 4.5:1 (SC 1.4.3)
   *   {surface}-alt-text on {surface}-input-bg      >= 4.5:1 (SC 1.4.3)
   *     (covers placeholder usage; placeholders are functional text)
   *   {surface}-border on {surface}-input-bg        >= 3:1   (SC 1.4.11)
   *     (input boundary visible against its own fill)
   *
   * The default :root / [data-mode='dark'] cascades no longer declare
   * the input slots — every shipped theme defines them per-theme. Those
   * fixtures skip the contract via the undefined-slot guard below.
   */
  describe('input bundle contract', () => {
    const INPUT_PAIRS = [
      { surface: 'base', fg: 'base-text', threshold: AA_NORMAL },
      { surface: 'base', fg: 'base-alt-text', threshold: AA_NORMAL },
      { surface: 'base', fg: 'base-border', threshold: AA_NON_TEXT },
      { surface: 'mount', fg: 'mount-text', threshold: AA_NORMAL },
      { surface: 'mount', fg: 'mount-alt-text', threshold: AA_NORMAL },
      { surface: 'mount', fg: 'mount-border', threshold: AA_NON_TEXT },
    ] as const;

    for (const fixture of FIXTURES) {
      const block = extractBlock(BUNDLES_CSS, fixture.selector);
      const declarations = parseDeclarations(block);

      const usablePairs = INPUT_PAIRS.filter((pair) => {
        const inputBg = declarations.get(`${pair.surface}-input-bg`);
        const fg = declarations.get(pair.fg);
        return (
          inputBg !== undefined &&
          fg !== undefined &&
          !inputBg.includes('var(') &&
          !fg.includes('var(')
        );
      });
      if (usablePairs.length === 0) {
        continue;
      }

      describe(`${fixture.label}`, () => {
        for (const pair of usablePairs) {
          const inputBg = declarations.get(`${pair.surface}-input-bg`)!;
          const fg = declarations.get(pair.fg)!;

          it(`${pair.fg} on ${pair.surface}-input-bg >= ${pair.threshold}:1`, () => {
            const foreground = resolveFg(parseColor(fg));
            const background = compositeOverBg(
              parseColor(inputBg),
              fixture.pageBg,
            );
            const ratio = contrastRatio(foreground, background);
            expect
              .soft(
                ratio,
                `${pair.fg} on ${pair.surface}-input-bg (${fixture.label}): got ${describeRatio(ratio)}`,
              )
              .toBeGreaterThanOrEqual(pair.threshold);
          });
        }
      });
    }
  });

  /*
   * Wave 22b documented two distinct intents for `--base-input-bg` vs
   * `--base-bg` on dark themes whose --base-border sits at the WCAG
   * razor-edge (~3:1 vs base-bg):
   *
   *   - school-of-rock dark: luminance-match-with-tint. The input-bg is
   *     a subtle warm-brown sitting inside the base-bg's luminance band
   *     so the border carries the entire SC 1.4.11 load. The visual
   *     distinction reads as "bordered shape on a near-uniform dark
   *     surface" — focus ring carries the focus affordance.
   *
   *   - boyhood dark: visible separation. The base-border #87973c is
   *     bright lime-olive (rel lum ~0.276) leaving comfortable headroom
   *     for darken-direction Recovery A; the input-bg #243618 sits well
   *     below the base-bg.
   *
   * These two themes are the only ones whose bundles.css comments
   * explicitly call out the intent. Mechanizing only those two keeps the
   * assertion set tight — every other theme's input-bg/base-bg
   * relationship is incidental and should not be retro-fitted with a
   * threshold. See chemist NICE-TO-HAVE in wave 23.1 gang findings.
   */
  describe('input-bg vs base-bg luminance intent (wave 22b)', () => {
    it('school-of-rock dark — base-input-bg matches base-bg luminance band (ratio <= 1.5)', () => {
      const block = extractBlock(
        BUNDLES_CSS,
        "[data-theme='school-of-rock'][data-mode='dark']",
      );
      const declarations = parseDeclarations(block);
      const inputBg = declarations.get('base-input-bg');
      const baseBg = declarations.get('base-bg');
      if (inputBg === undefined || baseBg === undefined) {
        throw new Error(
          'school-of-rock dark cascade missing base-input-bg or base-bg',
        );
      }
      const ratio = luminanceRatio(parseColor(inputBg), parseColor(baseBg));
      expect
        .soft(
          ratio,
          `school-of-rock dark base-input-bg vs base-bg: got ${ratio.toFixed(3)}`,
        )
        .toBeLessThanOrEqual(1.5);
    });

    it('boyhood dark — base-input-bg visibly separates from base-bg (ratio >= 1.4)', () => {
      const block = extractBlock(
        BUNDLES_CSS,
        "[data-theme='boyhood'][data-mode='dark']",
      );
      const declarations = parseDeclarations(block);
      const inputBg = declarations.get('base-input-bg');
      const baseBg = declarations.get('base-bg');
      if (inputBg === undefined || baseBg === undefined) {
        throw new Error(
          'boyhood dark cascade missing base-input-bg or base-bg',
        );
      }
      const ratio = luminanceRatio(parseColor(inputBg), parseColor(baseBg));
      expect
        .soft(
          ratio,
          `boyhood dark base-input-bg vs base-bg: got ${ratio.toFixed(3)}`,
        )
        .toBeGreaterThanOrEqual(1.4);
    });
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
   * `--orbit-border` over `--mount-bg` is the structural pair for the
   * elevated lift inside a mount-host card: IconButton variant="elevated"
   * on a mount surface paints `--orbit-bg` filled with `--orbit-border`
   * and sits on `--mount-bg`. SC 1.4.11 (3:1) applies on the border, not
   * on the bg-on-bg adjacency (`--orbit-bg` vs `--mount-bg` is
   * intentionally low across every theme — 1.07-1.46:1 — with the border
   * carrying the visual lift). Wave 24 mechanizes this pair so any
   * future palette tweak to either slot is caught.
   *
   * Brief originally listed `--orbit-bg` vs `--mount-bg >= 3:1`; that
   * pair fails every theme/mode by design and is not the WCAG-load-
   * bearing pair. Replaced with the structural border-on-host check per
   * [[feedback-verify-upstream-gate-claims]].
   */
  describe('orbit-border on mount-bg (elevated lift)', () => {
    for (const fixture of FIXTURES) {
      if (!fixture.checkAdjacency) {
        continue;
      }
      const block = extractBlock(BUNDLES_CSS, fixture.selector);
      const declarations = parseDeclarations(block);
      const orbitBorder = getSlot(declarations, 'orbit', 'border');
      const mountBg = getSlot(declarations, 'mount', 'bg');
      if (orbitBorder === null || mountBg === null) {
        continue;
      }

      it(`${fixture.label} >= 3:1`, () => {
        const ratio = contrastRatio(
          resolveFg(orbitBorder),
          compositeOverBg(mountBg, fixture.pageBg),
        );
        expect
          .soft(
            ratio,
            `orbit-border on mount-bg (${fixture.label}): got ${describeRatio(ratio)}`,
          )
          .toBeGreaterThanOrEqual(AA_NON_TEXT);
      });
    }
  });

  /*
   * `--orbit-border` over `--orbit-bg` is the structural pair for inner
   * lifted sub-surfaces inside an orbit-tier panel: WelcomeModal feature
   * tiles + KeyboardShortcutsModal kbd legends both sit on the orbit
   * panel with `border-[var(--orbit-border)]` carrying separation.
   * Wave 30 surfaced this pair via the diamantaire's gang-pass review —
   * the previous "orbit-border on mount-bg" pair did not cover the
   * sub-surface case because the host bg is now orbit, not mount.
   * Wave 30.1 mechanizes the pair so future palette tweaks are caught.
   * Tightest theme: before-sunset dark at ~3.017:1 (+0.017 over floor).
   */
  describe('orbit-border on orbit-bg (sub-surface on orbit panel)', () => {
    for (const fixture of FIXTURES) {
      if (!fixture.checkAdjacency) {
        continue;
      }
      const block = extractBlock(BUNDLES_CSS, fixture.selector);
      const declarations = parseDeclarations(block);
      const orbitBorder = getSlot(declarations, 'orbit', 'border');
      const orbitBg = getSlot(declarations, 'orbit', 'bg');
      if (orbitBorder === null || orbitBg === null) {
        continue;
      }

      it(`${fixture.label} >= 3:1`, () => {
        const ratio = contrastRatio(
          resolveFg(orbitBorder),
          compositeOverBg(orbitBg, fixture.pageBg),
        );
        expect
          .soft(
            ratio,
            `orbit-border on orbit-bg (${fixture.label}): got ${describeRatio(ratio)}`,
          )
          .toBeGreaterThanOrEqual(AA_NON_TEXT);
      });
    }
  });

  /*
   * Card-on-gradient lift — perceptual separation between each page-
   * gradient stop and the card's --mount-bg surface. Consumers paint
   * `bg-gradient-to-b from-[var(--page-gradient-from)] to-[var(--page-
   * gradient-to)]` behind a centered AuthCard whose edge is conveyed by
   * `border-shadow` (a box-shadow utility), NOT by
   * `border-[var(--mount-border)]`.
   *
   * NOT a WCAG SC 1.4.11 contract — the card edge does not depend on
   * stop-vs-mount-border separation. This is a design tripwire: if a
   * future theme tweak collapses the gradient-bg-vs-mount-bg luminance
   * gap to imperceptible, the card stops feeling lifted off the page.
   * Threshold 3.0 luminance ratio (perceptual separation, mirrors the
   * axis B pattern in [[feedback-bundle-hue-separation]]).
   *
   * Wave 40 retired the --text / --text-muted aliases the stops used to
   * resolve through; each per-theme cascade now declares its own
   * --page-gradient-{from,to} hex directly. Wave 49 retired the
   * --page-gradient-via mid-stop that was byte-identical to
   * --page-gradient-from in every theme. Pre-flight (wave 39) cleared
   * the matrix at 14.603:1 floor (nouvelle-vague light from-stop), so
   * every theme passes with massive headroom.
   *
   * Skips :root / [data-mode='dark'] fallback cascades — the :root
   * declares default stops but `checkAdjacency: false` already excludes
   * those fixtures. Per-theme cascades cover every runtime-painted
   * combination.
   */
  describe('card-on-gradient lift (page-gradient stops vs --mount-bg)', () => {
    const STOPS = ['page-gradient-from', 'page-gradient-to'] as const;

    for (const fixture of FIXTURES) {
      if (!fixture.checkAdjacency) {
        continue;
      }
      const block = extractBlock(BUNDLES_CSS, fixture.selector);
      const declarations = parseDeclarations(block);
      const mountBg = declarations.get('mount-bg');
      if (mountBg === undefined || mountBg.includes('var(')) {
        continue;
      }

      describe(`${fixture.label}`, () => {
        for (const stop of STOPS) {
          const stopValue = declarations.get(stop);
          if (stopValue === undefined || stopValue.includes('var(')) {
            continue;
          }

          it(`${stop} luminance ratio vs --mount-bg >= 3.0`, () => {
            const stopRgb = resolveFg(parseColor(stopValue));
            const background = compositeOverBg(
              parseColor(mountBg),
              fixture.pageBg,
            );
            const ratio = luminanceRatio(stopRgb, background);
            expect
              .soft(
                ratio,
                `${stop} vs --mount-bg (${fixture.label}): got ${ratio.toFixed(3)}`,
              )
              .toBeGreaterThanOrEqual(3.0);
          });
        }
      });
    }
  });

  /*
   * Alert idle paint on host surfaces — the IconButton `danger` variant
   * paints `--alert-text` + `--alert-border` directly on its host bg (no
   * `--alert-bg` wrapper) at rest. The hover transient does fill
   * `--alert-bg`, but the idle pair is what the consumer reads most of
   * the time.
   *
   * Scoped to alert only — the `danger` variant is the only intrinsic
   * state-bundle IconButton variant, and Alert.tsx/StatusBadge.tsx
   * always pair `--{state}-border` with `--{state}-bg` (the in-bundle
   * CONTRACT iteration above covers those). Warn/info/success on host
   * bg are not real consumer pairs today; if a future consumer adds
   * one, expand this block.
   *
   * Mirrors the wave-20 `state-text on base-bg` block above
   * ([[feedback-state-text-on-base-bg-test-pair]]) extended to the
   * mount and orbit tiers an IconButton can ride. Wave 24 mechanized
   * after a culori pre-flight cleared the matrix worst-case at 3.275:1
   * (alert-border on orbit-bg, before-midnight dark).
   */
  describe('alert idle paint on host surfaces', () => {
    const HOST_PAIRS = [
      { host: 'mount' as const, threshold: AA_NORMAL, slot: 'text' as const },
      { host: 'orbit' as const, threshold: AA_NORMAL, slot: 'text' as const },
      {
        host: 'mount' as const,
        threshold: AA_NON_TEXT,
        slot: 'border' as const,
      },
      {
        host: 'orbit' as const,
        threshold: AA_NON_TEXT,
        slot: 'border' as const,
      },
    ];

    for (const fixture of FIXTURES) {
      if (!fixture.checkAdjacency) {
        continue;
      }
      const block = extractBlock(BUNDLES_CSS, fixture.selector);
      const declarations = parseDeclarations(block);

      describe(`${fixture.label}`, () => {
        for (const { host, threshold, slot } of HOST_PAIRS) {
          const hostBg = getSlot(declarations, host, 'bg');
          if (hostBg === null) continue;

          const stateSlot = getSlot(declarations, 'alert', slot);
          if (stateSlot === null) continue;

          it(`alert-${slot} on ${host}-bg >= ${threshold}:1`, () => {
            const ratio = contrastRatio(
              resolveFg(stateSlot),
              compositeOverBg(hostBg, fixture.pageBg),
            );
            expect
              .soft(
                ratio,
                `alert-${slot} on ${host}-bg (${fixture.label}): got ${describeRatio(ratio)}`,
              )
              .toBeGreaterThanOrEqual(threshold);
          });
        }
      });
    }
  });

  /*
   * Cross-bundle highlight adjacencies — `--{tier}-highlight` painted on a
   * DIFFERENT tier's bg. Per-bundle CONTRACT above covers highlight on its
   * own bg; these four pairs cover the consumer geometries where a highlight
   * slot lives on a foreign host. SC 1.4.11 (3:1) per pair.
   *
   *   1. mount-highlight on base-bg — LinkCardLayout loading-bar geometry
   *      (`-translate-x-full` shifts the bar off the card's left edge so it
   *      paints on the page, not on the card's mount-bg). LinkCardLayout.tsx:157-158.
   *   2. orbit-highlight on mount-bg — CvdModeToggle aria-checked capsule
   *      bg painted inside a SettingsGroup mount-host. CvdModeToggle.tsx:78.
   *   3. base-highlight on mount-bg — SettingsGroup data-active=true border
   *      painted on the section's own mount-bg fill (the matching outline
   *      sits on base-bg and is covered by the CONTRACT loop's
   *      `base-highlight on base-bg`). SettingsGroup.tsx:89.
   *   4. base-highlight on orbit-bg — `[data-cvd='on'] [aria-checked='true']`
   *      inset 3px box-shadow bar painted on orbit-host menu items (InlineThemeList
   *      inside MobileBottomSheet). index.css:159-164, InlineThemeList.tsx:28.
   *
   * Pre-flight (wave 47) cleared the matrix worst-case at 3.282:1
   * (mount-highlight on base-bg, before-midnight light). Diamantaire nit from
   * waves 41-44 flagged pair 1 specifically — wave 43 verified ad-hoc but
   * left the contract un-mechanized.
   */
  describe('cross-bundle highlight adjacencies', () => {
    const CROSS_PAIRS = [
      { fgBundle: 'mount' as const, hostBundle: 'base' as const },
      { fgBundle: 'orbit' as const, hostBundle: 'mount' as const },
      { fgBundle: 'base' as const, hostBundle: 'mount' as const },
      { fgBundle: 'base' as const, hostBundle: 'orbit' as const },
    ];

    for (const fixture of FIXTURES) {
      if (!fixture.checkAdjacency) {
        continue;
      }
      const block = extractBlock(BUNDLES_CSS, fixture.selector);
      const declarations = parseDeclarations(block);

      describe(`${fixture.label}`, () => {
        for (const { fgBundle, hostBundle } of CROSS_PAIRS) {
          const highlight = getSlot(declarations, fgBundle, 'highlight');
          const hostBg = getSlot(declarations, hostBundle, 'bg');
          if (highlight === null || hostBg === null) continue;

          it(`${fgBundle}-highlight on ${hostBundle}-bg >= 3:1`, () => {
            const ratio = contrastRatio(
              resolveFg(highlight),
              compositeOverBg(hostBg, fixture.pageBg),
            );
            expect
              .soft(
                ratio,
                `${fgBundle}-highlight on ${hostBundle}-bg (${fixture.label}): got ${describeRatio(ratio)}`,
              )
              .toBeGreaterThanOrEqual(AA_NON_TEXT);
          });
        }
      });
    }
  });
});
