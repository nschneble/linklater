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
 * read it straight out of bundles.css for each FIXTURES entry.
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

    /*
     * Resolve `--focus-ring` to a literal hex.
     *
     * Legitimate shapes today:
     *  1. Undefined (no `--focus-ring` declared in this fixture's block) —
     *     return null so the caller can skip the fixture cleanly. Some
     *     test fixtures (e.g. the default :root cascade) deliberately do
     *     not declare a focus ring; only per-theme blocks do.
     *  2. `var(--accent)` with no themeCss/mode supplied — happens for
     *     the default cascade fixtures (`:root`, `[data-mode='dark']`)
     *     where there is no per-theme stylesheet to chase. Return null
     *     so the caller skips the fixture cleanly; the per-theme cascade
     *     fixtures cover the same alias.
     *  3. Literal hex (e.g. apollo dark's explicit `#c8b896`).
     *  4. `var(--{alias})` for a per-theme cascade — chase the alias
     *     through the corresponding theme stylesheet's per-mode block.
     *     Today the only alias in use is `var(--accent)`; the
     *     generalized resolver below handles any future
     *     `var(--mount-highlight)` / `var(--base-text)` etc. without
     *     requiring a new branch here.
     *
     * Anything else (a misspelled function, an unknown literal in a
     * per-theme block) gets returned as `'__UNRESOLVED__'` so the caller
     * can fail loud rather than silently skip the fixture and lose
     * coverage. See a11y-lead MINOR in wave 23.1 gang findings — silent-
     * skip on aliases was the bug.
     */
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
      const aliasMatch = value.match(/^var\(--([a-z-]+)\)$/);
      if (!aliasMatch) {
        return '__UNRESOLVED__';
      }
      if (!themeCss || !mode) {
        // Default cascade fixtures (:root, [data-mode='dark']) ship a
        // `var(--accent)` alias but have no per-theme stylesheet to
        // chase. The per-theme cascades exercise the same alias under a
        // resolvable context.
        return null;
      }
      const aliasName = aliasMatch[1];
      const blockRe = new RegExp(
        `\\[data-theme='[^']+'\\]\\[data-mode='${mode}'\\]\\s*\\{([\\s\\S]*?)\\n\\}`,
      );
      const m = themeCss.match(blockRe);
      if (!m) {
        return '__UNRESOLVED__';
      }
      const aliasDeclRe = new RegExp(`--${aliasName}:\\s*([^;]+);`);
      const aliasDecl = m[1].match(aliasDeclRe);
      if (!aliasDecl) {
        return '__UNRESOLVED__';
      }
      const resolved = aliasDecl[1].trim();
      // Only hex-literal aliases are supported. A nested var() would
      // require multi-hop resolution that no theme uses today; fail loud
      // rather than skip.
      if (!resolved.startsWith('#')) {
        return '__UNRESOLVED__';
      }
      return resolved;
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
});
