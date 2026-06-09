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

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
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
   * Whether to run the border-vs-page-bg adjacency check. False for the
   * `:root` + `[data-mode='dark']` defensive defaults (no runtime
   * consumer paints them — all 10 themes have per-theme cascades).
   * True for every per-theme fixture, which self-contains a concrete
   * --base-bg.
   */
  readonly checkAdjacency: boolean;
}

/*
 * Default cascade (`:root`, `[data-mode='dark']`) does not redefine
 * --base-bg — the bundles cascade aliases it to `var(--bg)`. So the
 * page background for the default cascade comes from default.css's
 * `:root --bg`. The default cascade's state-bundle borders are pure
 * defensive fallback now that all 10 shipped themes carry their own
 * per-theme bundle cascades — `checkAdjacency: false` skips the border
 * adjacency assertions for `:root` + `[data-mode='dark']` since no
 * runtime consumer paints the default cascade's state borders.
 * Per-theme cascades define --base-bg directly as hex; we read it
 * straight out of bundles.css for each FIXTURES entry.
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
   * Most themes alias `--focus-ring: var(--accent);`. To resolve the
   * alias for testing, we read the matching theme's per-mode --accent
   * from its <theme>.css. apollo dark's explicit hex bypasses this
   * resolution path.
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

    function resolveFocusRing(
      declarations: Map<string, string>,
      themeCss: string | null,
      mode: 'light' | 'dark' | null,
    ): string | null {
      const value = declarations.get('focus-ring');
      if (value === undefined) {
        return null;
      }
      if (value.startsWith('#')) {
        return value;
      }
      if (value === 'var(--accent)' && themeCss && mode) {
        const blockRe = new RegExp(
          `\\[data-theme='[^']+'\\]\\[data-mode='${mode}'\\]\\s*\\{([\\s\\S]*?)\\n\\}`,
        );
        const m = themeCss.match(blockRe);
        if (!m) return null;
        const accentMatch = m[1].match(/--accent:\s*([^;]+);/);
        return accentMatch ? accentMatch[1].trim() : null;
      }
      return null;
    }

    function themeAndModeFromSelector(
      selector: string,
    ): { theme: string; mode: 'light' | 'dark' } | null {
      const m = selector.match(
        /\[data-theme='([^']+)'\]\[data-mode='(light|dark)'\]/,
      );
      if (!m) return null;
      return { theme: m[1], mode: m[2] as 'light' | 'dark' };
    }

    for (const fixture of FIXTURES) {
      const block = extractBlock(BUNDLES_CSS, fixture.selector);
      const declarations = parseDeclarations(block);
      const themeMode = themeAndModeFromSelector(fixture.selector);
      let themeCss: string | null = null;
      if (themeMode) {
        const stylesDir = dirname(fileURLToPath(import.meta.url));
        try {
          themeCss = readFileSync(
            resolve(stylesDir, `${themeMode.theme}.css`),
            'utf8',
          );
        } catch {
          themeCss = null;
        }
      }
      const focusRing = resolveFocusRing(
        declarations,
        themeCss,
        themeMode?.mode ?? null,
      );
      if (focusRing === null) {
        continue;
      }

      describe(`${fixture.label}`, () => {
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
   * `--{state}-bg` wrapper). Real consumers: TokenInput validation error
   * paragraph, AppShell warn banner text fallback under specific media
   * queries. The text/bg-in-bundle contract above covers `--alert-text`
   * over `--alert-bg`; this block covers `--alert-text` over `--base-bg`
   * which has no equivalent in the per-bundle CONTRACT iteration.
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
   * tuning the form-input fill per host surface. Wave 22a adds the
   * slots + mount-input-bg per-theme values (consumed by ColorEditor).
   * Wave 22b will add per-theme --base-input-bg values + migrate
   * FormInput + LinksToolbar.
   *
   * Contract per slot:
   *   {surface}-text on {surface}-input-bg          >= 4.5:1 (SC 1.4.3)
   *   {surface}-alt-text on {surface}-input-bg      >= 4.5:1 (SC 1.4.3)
   *     (covers placeholder usage; placeholders are functional text)
   *   {surface}-border on {surface}-input-bg        >= 3:1   (SC 1.4.11)
   *     (input boundary visible against its own fill)
   *
   * Fixtures whose --{surface}-input-bg is still aliased
   * (`var(--bg-input)`) skip — the legacy alias is verified by the
   * existing flat-token contract review.
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
});
