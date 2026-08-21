/*
 * Bundle contrast contract - automated WCAG verification.
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
 * Encodes the contract so any regression - a hex tweak below threshold, a
 * forgotten composite, a typo in an alpha value - surfaces in CI.
 *
 * Soft assertions are used so a single run reports every failing pair,
 * not just the first.
 *
 * Sister suite: bundles.distinguishability.test.ts encodes the
 * CVD-distinguishability invariant from feedback-bundle-hue-separation.
 * Shared color parsing + WCAG helpers live in bundles-color-utils.ts.
 */

import {
  bundleIsFullyDefined,
  BUNDLES,
  BUNDLES_CSS,
  CARD_BUNDLES,
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
  stripComments,
} from './bundles-color-utils';
import { describe, expect, it } from 'vitest';
import type { Rgb, Rgba, Slot } from './bundles-color-utils';

/**
 * Drops the alpha channel. Named rather than inlined because discarding it
 * is only sound for a colour that is already opaque: a translucent one has
 * to be composited over what sits behind it first, and every value below
 * is a literal with no transparency.
 */
function opaque([red, green, blue]: Rgba): Rgb {
  return [red, green, blue];
}

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
   * consumer paints them - all 10 themes have per-theme cascades).
   * True for every per-theme fixture, which self-contains a concrete
   * --base-bg.
   */
  readonly checkAdjacency: boolean;
}

/*
 * Default cascade (`:root`, `[data-mode='dark']`) pins --base-bg to an
 * explicit hex in `bundles.css :root` (the legacy
 * `--bg` flat-token alias). The default cascade's state-bundle borders
 * are pure defensive fallback now that all 10 shipped themes carry
 * their own per-theme bundle cascades - `checkAdjacency: false` skips
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
/*
 * branding is the OFF-BOOK brand-chrome theme: DARK-LOCKED / mode-independent,
 * so its selector has NO `[data-mode]` qualifier (see branding.css). The
 * (theme × mode) iteration below integrates it as a single block. Its own
 * --base-bg (#0a0812, the bg-hit-man radial's outer stop) is the page bg the
 * alpha state-bundle bgs composite over.
 */
const BRANDING_PAGE_BG: Rgb = readPageBg(
  BUNDLES_CSS,
  "[data-theme='branding']",
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
  {
    // off-book brand-chrome theme, mode-independent (no [data-mode]); it
    // self-contains a concrete --base-bg, so the per-theme adjacency checks
    // apply. Excluded by label from the card-on-gradient lift block below:
    // near-black chrome can't separate the card from the gradient by luminance.
    label: 'branding',
    selector: "[data-theme='branding']",
    pageBg: BRANDING_PAGE_BG,
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
   * each state bundle's composited bg, and both input fills.
   *
   * The two input fills are here because a text input has no border left
   * to separate them from the outline: it drops the border to transparent
   * on focus and sits the band flush, so the band is the whole boundary
   * and its inner edge meets the fill. The theme editor's hex row is the
   * exception, keeping its border and holding the band clear, because
   * that border turns alert-coloured on an invalid value. Tightest is the
   * base fill on before-sunrise dark at 3.455:1, so the headroom is real
   * but thin.
   *
   * Every per-theme cascade ships an explicit `--focus-ring: #...` hex;
   * the `:root` synthetic fallback omits the slot, so the resolver
   * returns null for that fixture and the per-theme cascades carry it.
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
      'base-input-bg',
      'mount-input-bg',
    ] as const;

    /*
     * Resolve `--focus-ring` to a literal hex.
     *  1. Undefined (slot not declared, e.g. the synthetic :root /
     *     [data-mode='dark'] cascades) - return null so the caller skips
     *     the fixture cleanly. Only per-theme blocks declare it.
     *  2. Literal hex (every per-theme block ships one).
     *
     * Anything else returns `'__UNRESOLVED__'` so the caller fails loud
     * rather than silently skip the fixture and lose coverage.
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
          // fail loud: a silent skip would mask a future alias the
          // resolver does not know how to chase
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
   * page-chrome consumers: kbd legends, helper hints, chevrons, the
   * descriptive line under section nav pills. Contract: clears 4.5:1
   * against --base-bg per SC 1.4.3.
   *
   * Lives outside the CONTRACT iteration above because that loop applies
   * the same slot set to all 7 bundles; introducing a base-only slot
   * cannot use that shape.
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
   * branding `--base-alt-text` is EndpointNav's resting endpoint label,
   * painted directly on the `bg-hit-man` radial gradient, NOT a flat
   * surface. The CONTRACT loop above checks `base-alt-text on base-bg`
   * over a single `fixture.pageBg`, which for branding is the gradient's
   * OUTER stop (#0a0812). The selection list also rides up over the
   * BRIGHTER top stop (#14103a), the harder contrast case, so this block
   * pins the resting label against BOTH gradient stops at SC 1.4.3 (4.5:1).
   */
  describe('branding base-alt-text on both gradient stops', () => {
    const BRANDING_TOP_STOP = opaque(parseColor('#14103a'));
    const BRANDING_OUTER_STOP = opaque(parseColor('#0a0812'));
    const block = extractBlock(BUNDLES_CSS, "[data-theme='branding']");
    const declarations = parseDeclarations(block);
    const altText = declarations.get('base-alt-text');

    for (const [label, stop] of [
      ['top stop #14103a', BRANDING_TOP_STOP],
      ['outer stop #0a0812', BRANDING_OUTER_STOP],
    ] as const) {
      it(`base-alt-text on ${label} >= 4.5:1`, () => {
        if (altText === undefined || altText.includes('var(')) {
          throw new Error('branding cascade missing concrete --base-alt-text');
        }
        const ratio = contrastRatio(resolveFg(parseColor(altText)), stop);
        expect
          .soft(
            ratio,
            `base-alt-text on ${label} (branding): got ${describeRatio(ratio)}`,
          )
          .toBeGreaterThanOrEqual(AA_NORMAL);
      });
    }
  });

  /*
   * Branding backs every LOGGED-OUT auth surface, so its cascade MUST declare
   * the `--page-gradient-{from,to}` stops the `Unauthenticated.tsx` AuthCard
   * wrapper paints (`bg-gradient-to-b from-[var(--page-gradient-from)]
   * to-[var(--page-gradient-to)]`). Omitting them leaks to the :root amber/cream
   * fallback and collapses --mount-text on the card to ~1:1. Presence
   * tripwire: fails loud on absence.
   */
  describe('branding page-gradient stops are defined', () => {
    const declarations = parseDeclarations(
      extractBlock(BUNDLES_CSS, "[data-theme='branding']"),
    );
    for (const stop of ['page-gradient-from', 'page-gradient-to'] as const) {
      it(`declares --${stop} as a concrete color`, () => {
        const value = declarations.get(stop);
        expect(value).toBeDefined();
        expect(value).not.toContain('var(');
      });
    }
  });

  /*
   * The logged-out AuthCard (bg --mount-bg = white @5%) composited over BOTH
   * branding page-gradient stops. Every slot the card and its in-card state
   * surfaces paint must clear WCAG-AA over the harder (lighter) top stop as
   * well as the outer stop:
   *   - card text/alt-text >= 4.5 (SC 1.4.3); card border + focus-ring >= 3
   *     (SC 1.4.11 / 2.4.7)
   *   - in-card alert/success text >= 4.5 over the state-bg composited on the
   *     card; their borders >= 3 over the card AND the page --base-bg.
   */
  describe('branding auth card over page-gradient', () => {
    const declarations = parseDeclarations(
      extractBlock(BUNDLES_CSS, "[data-theme='branding']"),
    );
    const concrete = (name: string): string => {
      const value = declarations.get(name);
      if (value === undefined || value.includes('var(')) {
        throw new Error(`branding cascade missing concrete --${name}`);
      }
      return value;
    };
    const mountBg = parseColor(concrete('mount-bg'));
    const baseBg = resolveFg(parseColor(concrete('base-bg')));

    for (const [stopLabel, stopName] of [
      ['top stop', 'page-gradient-from'],
      ['outer stop', 'page-gradient-to'],
    ] as const) {
      describe(`${stopLabel}`, () => {
        const card = compositeOverBg(
          mountBg,
          resolveFg(parseColor(concrete(stopName))),
        );

        const cardPairs: ReadonlyArray<readonly [string, number]> = [
          ['mount-text', AA_NORMAL],
          ['mount-alt-text', AA_NORMAL],
          ['mount-border', AA_NON_TEXT],
          ['focus-ring', AA_NON_TEXT],
        ];
        for (const [slot, threshold] of cardPairs) {
          it(`--${slot} on the card >= ${threshold}:1`, () => {
            const ratio = contrastRatio(
              resolveFg(parseColor(concrete(slot))),
              card,
            );
            expect
              .soft(
                ratio,
                `--${slot} on card (${stopLabel}): ${describeRatio(ratio)}`,
              )
              .toBeGreaterThanOrEqual(threshold);
          });
        }

        for (const state of ['alert', 'success'] as const) {
          const stateCard = compositeOverBg(
            parseColor(concrete(`${state}-bg`)),
            card,
          );
          it(`--${state}-text on its in-card surface >= 4.5:1`, () => {
            const ratio = contrastRatio(
              resolveFg(parseColor(concrete(`${state}-text`))),
              stateCard,
            );
            expect
              .soft(
                ratio,
                `--${state}-text on card (${stopLabel}): ${describeRatio(ratio)}`,
              )
              .toBeGreaterThanOrEqual(AA_NORMAL);
          });
          it(`--${state}-border >= 3:1 over the card and the page --base-bg`, () => {
            const border = resolveFg(parseColor(concrete(`${state}-border`)));
            expect
              .soft(
                contrastRatio(border, card),
                `--${state}-border on card (${stopLabel})`,
              )
              .toBeGreaterThanOrEqual(AA_NON_TEXT);
            expect
              .soft(
                contrastRatio(border, baseBg),
                `--${state}-border on base-bg`,
              )
              .toBeGreaterThanOrEqual(AA_NON_TEXT);
          });
        }
      });
    }
  });

  /*
   * `--border-shadow-color` pins the mode-independent card-edge tint on the
   * branding cascade. border-shadow.css only sets it under `[data-mode='dark']`,
   * so without this a logged-out visitor in light mode gets the #000000
   * fallback, invisible on the navy card.
   */
  describe('branding border-shadow-color', () => {
    const declarations = parseDeclarations(
      extractBlock(BUNDLES_CSS, "[data-theme='branding']"),
    );
    it('is pinned to #ffffff', () => {
      expect(declarations.get('border-shadow-color')).toBe('#ffffff');
    });
  });

  /*
   * Alert/success source-order pin. Branding is
   * mode-independent, but `bundles.css [data-mode='dark']` also declares
   * `--alert-bg`/`--success-bg` at the SAME specificity (single attribute
   * selector). A logged-out visitor can carry data-mode='dark', so which one
   * wins is decided by CSS source order. branding.css is concatenated AFTER
   * bundles.css in BUNDLES_CSS, so branding's 0.55-alpha values win over the
   * dark 0.4-alpha defaults. This pins both that the two are genuinely
   * different AND that branding is later in source, so the resolved bg is
   * branding's own. Alpha is encoded as the trailing hex byte: 0.55 -> 8c,
   * 0.4 -> 66.
   *
   * Both offsets are read from comment-stripped source. Against the raw
   * string the branding offset landed at 47358, inside branding.css's own
   * preamble describing the block, so the order held by luck of where the
   * prose sits rather than by where the rules do.
   */
  describe('branding alert/success bg wins by source order', () => {
    const cascadeSource = stripComments(BUNDLES_CSS);
    const brandingIndex = cascadeSource.indexOf("[data-theme='branding']");
    const darkModeIndex = cascadeSource.indexOf("[data-mode='dark']");
    const brandingDecls = parseDeclarations(
      extractBlock(BUNDLES_CSS, "[data-theme='branding']"),
    );
    const darkDecls = parseDeclarations(
      extractBlock(BUNDLES_CSS, "[data-mode='dark']"),
    );

    it('measures both offsets at a rule, not at a mention of one', () => {
      expect(cascadeSource.slice(brandingIndex)).toMatch(
        /^\[data-theme='branding'\]\s*\{/,
      );
      expect(cascadeSource.slice(darkModeIndex)).toMatch(
        /^\[data-mode='dark'\]\s*\{/,
      );
    });

    it('branding cascade is later in source than [data-mode=dark]', () => {
      expect(brandingIndex).toBeGreaterThan(-1);
      expect(darkModeIndex).toBeGreaterThan(-1);
      expect(brandingIndex).toBeGreaterThan(darkModeIndex);
    });

    for (const state of ['alert', 'success'] as const) {
      it(`resolves --${state}-bg to branding's 0.55-alpha value, not the dark 0.4-alpha`, () => {
        const brandingValue = brandingDecls.get(`${state}-bg`);
        const darkValue = darkDecls.get(`${state}-bg`);
        expect(brandingValue).toMatch(/^#[0-9a-f]{6}8c$/i);
        expect(darkValue).toMatch(/^#[0-9a-f]{6}66$/i);
        expect(brandingValue).not.toBe(darkValue);
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
   *
   * SECOND consumer (theme editor): the title-row contrast-status icon
   * paints `--success-text` (clean) / `--warn-text` (failing) directly
   * on the page `--base-bg`. As a non-text status glyph it needs only SC
   * 1.4.11 (3:1), which the 4.5:1 assertions below already SUBSUME for every
   * theme, so warn-text never falls back to alert-text. No separate weaker
   * 3:1 pair is added; this stronger pair IS the icon's contract gate.
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
   * tuning the form-input fill per host surface. Painted by FormInput,
   * LinksToolbar, ColorRow, CodeBlock, CurlExample and MockToolbar.
   *
   * Contract per slot:
   *   {surface}-text on {surface}-input-bg          >= 4.5:1 (SC 1.4.3)
   *   {surface}-alt-text on {surface}-input-bg      >= 4.5:1 (SC 1.4.3)
   *     (covers placeholder usage; placeholders are functional text)
   *   {surface}-border on {surface}-input-bg        >= 3:1   (SC 1.4.11)
   *     (input boundary visible against its own fill)
   *
   * The default :root / [data-mode='dark'] cascades no longer declare
   * the input slots; every shipped theme defines them per-theme. Those
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
   * Two distinct intents are documented for `--base-input-bg` vs
   * `--base-bg` on dark themes whose --base-border sits at the WCAG
   * razor-edge (~3:1 vs base-bg):
   *
   *   - school-of-rock dark: luminance-match-with-tint. The input-bg is
   *     a subtle warm-brown sitting inside the base-bg's luminance band
   *     so the border carries the entire SC 1.4.11 load. The visual
   *     distinction reads as "bordered shape on a near-uniform dark
   *     surface" - focus ring carries the focus affordance.
   *
   *   - boyhood dark: visible separation. The base-border #87973c is
   *     bright lime-olive (rel lum ~0.276) leaving comfortable headroom
   *     for darken-direction Recovery A; the input-bg #243618 sits well
   *     below the base-bg.
   *
   * These two themes are the only ones whose bundles.css comments
   * explicitly call out the intent. Mechanizing only those two keeps the
   * assertion set tight; every other theme's input-bg/base-bg
   * relationship is incidental and should not be retro-fitted with a
   * threshold.
   */
  describe('input-bg vs base-bg luminance intent', () => {
    it('school-of-rock dark – base-input-bg matches base-bg luminance band (ratio <= 1.5)', () => {
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
      const ratio = luminanceRatio(
        opaque(parseColor(inputBg)),
        opaque(parseColor(baseBg)),
      );
      expect
        .soft(
          ratio,
          `school-of-rock dark base-input-bg vs base-bg: got ${ratio.toFixed(3)}`,
        )
        .toBeLessThanOrEqual(1.5);
    });

    it('boyhood dark – base-input-bg visibly separates from base-bg (ratio >= 1.4)', () => {
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
      const ratio = luminanceRatio(
        opaque(parseColor(inputBg)),
        opaque(parseColor(baseBg)),
      );
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
   * intentionally low across every theme, 1.07-1.46:1, with the border
   * carrying the visual lift).
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
   * `--warn-text` over `--mount-bg` backs the Theme Editor's per-bundle
   * contrast-error triangle (`BundleTabs`): the glyph paints `--warn-text` on
   * the mount-tier tab pill. It IS the at-a-glance triage signal, so it's a
   * required graphical object (SC 1.4.11) and must clear 3:1 on every theme.
   * Tightest film theme: before-midnight light ~7.70:1.
   */
  describe('warn-text on mount-bg (BundleTabs error glyph)', () => {
    for (const fixture of FIXTURES) {
      if (!fixture.checkAdjacency) {
        continue;
      }
      const block = extractBlock(BUNDLES_CSS, fixture.selector);
      const declarations = parseDeclarations(block);
      const warnText = getSlot(declarations, 'warn', 'text');
      const mountBg = getSlot(declarations, 'mount', 'bg');
      if (warnText === null || mountBg === null) {
        continue;
      }

      it(`${fixture.label} >= 3:1`, () => {
        const ratio = contrastRatio(
          resolveFg(warnText),
          compositeOverBg(mountBg, fixture.pageBg),
        );
        expect
          .soft(
            ratio,
            `warn-text on mount-bg (${fixture.label}): got ${describeRatio(ratio)}`,
          )
          .toBeGreaterThanOrEqual(AA_NON_TEXT);
      });
    }
  });

  /*
   * `--orbit-border` over `--orbit-bg` is the structural pair for inner
   * lifted sub-surfaces inside an orbit-tier panel: WelcomeModal feature
   * tiles + KeyboardShortcutsModal kbd legends both sit on the orbit
   * panel with `border-[var(--orbit-border)]` carrying separation. The
   * host bg is orbit here, not mount, so this is distinct from the
   * elevated-lift pair above. Tightest theme: before-sunset dark ~3.017:1.
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
   * Card-on-gradient lift: perceptual separation between each page-
   * gradient stop and the card's --mount-bg surface. Consumers paint
   * `bg-gradient-to-b from-[var(--page-gradient-from)] to-[var(--page-
   * gradient-to)]` behind a centered AuthCard whose edge is conveyed by
   * `border-shadow` (a box-shadow utility), NOT by
   * `border-[var(--mount-border)]`.
   *
   * NOT a WCAG SC 1.4.11 contract: the card edge does not depend on
   * stop-vs-mount-border separation. This is a design tripwire: if a
   * future theme tweak collapses the gradient-bg-vs-mount-bg luminance
   * gap to imperceptible, the card stops feeling lifted off the page.
   * Threshold 3.0 luminance ratio (perceptual separation, mirrors the
   * axis B pattern in [[feedback-bundle-hue-separation]]).
   *
   * Each per-theme cascade declares its own --page-gradient-{from,to}
   * hex directly. Pre-flight cleared the matrix at a 14.603:1 floor
   * (nouvelle-vague light from-stop), so every theme passes with headroom.
   *
   * Skips :root / [data-mode='dark'] fallback cascades - the :root
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
      // branding excluded: near-black chrome separates the AuthCard via the
      // white .border-shadow, not bg-luminance, so the 3.0 lift threshold
      // doesn't apply; its card contrast is WCAG-verified below
      if (fixture.label === 'branding') {
        continue;
      }
      const block = extractBlock(BUNDLES_CSS, fixture.selector);
      const declarations = parseDeclarations(block);
      const mountBg = declarations.get('mount-bg');
      if (mountBg === undefined || mountBg.includes('var(')) {
        continue;
      }

      // skip fixtures with no concrete gradient stops: an empty per-fixture
      // describe registers zero it() calls and vitest fails the empty suite
      const declaresAnyStop = STOPS.some((stop) => {
        const value = declarations.get(stop);
        return value !== undefined && !value.includes('var(');
      });
      if (!declaresAnyStop) {
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
   * Alert idle paint on host surfaces - the IconButton `danger` variant
   * paints `--alert-text` + `--alert-border` directly on its host bg (no
   * `--alert-bg` wrapper) at rest. The hover transient does fill
   * `--alert-bg`, but the idle pair is what the consumer reads most of
   * the time.
   *
   * Scoped to alert only: the `danger` variant is the only intrinsic
   * state-bundle IconButton variant, and Alert.tsx/StatusBadge.tsx
   * always pair `--{state}-border` with `--{state}-bg` (the in-bundle
   * CONTRACT iteration above covers those). Warn/info/success on host
   * bg are not real consumer pairs today; if a future consumer adds
   * one, expand this block.
   *
   * Worst case: alert-border on orbit-bg, before-midnight dark, 3.275:1.
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
   * A mount-tier form on a card that is not mount-tier. ReauthForm asks
   * for the mount surface at both of its inputs and takes no surface of
   * its own, so the tier is fixed at the component rather than chosen per
   * call site. One of its two hosts is the account-deletion path, which
   * renders it inside the danger variant of a settings card; that variant
   * fills from the alert bundle. The prompt, the field labels and the
   * cancel link paint the mount text tiers straight onto that fill, and
   * the input paints the mount border on it.
   *
   * The alert fill carries alpha on most cascades, so the card is that
   * fill composited over the page rather than the raw token.
   *
   * Tightest is the border on nouvelle-vague light at 3.013:1, which is
   * a third of a percent of headroom on a non-text check.
   */
  describe('mount-tier form on the danger card', () => {
    const CARD_PAIRS = [
      { slot: 'border' as const, threshold: AA_NON_TEXT },
      { slot: 'text' as const, threshold: AA_NORMAL },
      { slot: 'alt-text' as const, threshold: AA_NORMAL },
    ];

    for (const fixture of FIXTURES) {
      if (!fixture.checkAdjacency) {
        continue;
      }
      const block = extractBlock(BUNDLES_CSS, fixture.selector);
      const declarations = parseDeclarations(block);
      const alertBg = getSlot(declarations, 'alert', 'bg');
      if (alertBg === null) {
        continue;
      }
      const usablePairs = CARD_PAIRS.flatMap((pair) => {
        const value = getSlot(declarations, 'mount', pair.slot);
        if (value === null) {
          return [];
        }
        return [{ ...pair, value }];
      });
      if (usablePairs.length === 0) {
        continue;
      }
      const card = compositeOverBg(alertBg, fixture.pageBg);

      describe(`${fixture.label}`, () => {
        for (const { slot, threshold, value } of usablePairs) {
          it(`mount-${slot} on the danger card >= ${threshold}:1`, () => {
            const ratio = contrastRatio(resolveFg(value), card);
            expect
              .soft(
                ratio,
                `mount-${slot} on the danger card (${fixture.label}): got ${describeRatio(ratio)}`,
              )
              .toBeGreaterThanOrEqual(threshold);
          });
        }
      });
    }
  });

  /*
   * ResponseTabs status-pill contract - the master-detail response widget
   * inside EndpointDetail renders a tablist of status-code pills on the
   * `--mount-bg` card surface. The selected pill fills `--orbit-bg` with an
   * `--orbit-border` ring and `--orbit-text` digits; unselected pills paint
   * `--base-alt-text` on the bare card.
   *
   * Three SC pairs, two of which are NOT otherwise mechanized for THIS
   * geometry:
   *   1. orbit-border on mount-bg >= 3:1 (SC 1.4.11) - the selected ring
   *      against the CARD it sits on, NOT --base-bg. Orbit is tuned against
   *      --base-bg, so accent ≈ card surface in dark themes is the genuine
   *      risk. Already covered by the "orbit-border on mount-bg (elevated
   *      lift)" block above (IconButton shares the geometry); re-asserted
   *      here so the ResponseTabs contract reads as a single unit.
   *   2. orbit-text on orbit-bg >= 4.5:1 (SC 1.4.3) - selected pill digits on
   *      the fill. The per-bundle CONTRACT loop's `text on bg` covers orbit,
   *      so this is belt-and-braces for the same slot pair.
   *   3. base-alt-text on mount-bg >= 4.5:1 (SC 1.4.3) - unselected pill
   *      digits on the card. FRESH pair: EndpointNav uses base-alt-text on
   *      --base-bg (the gutter); here the pills render on --mount-bg.
   */
  describe('ResponseTabs status-pill contract', () => {
    for (const fixture of FIXTURES) {
      if (!fixture.checkAdjacency) {
        continue;
      }
      const block = extractBlock(BUNDLES_CSS, fixture.selector);
      const declarations = parseDeclarations(block);
      const orbitBorder = getSlot(declarations, 'orbit', 'border');
      const orbitBg = getSlot(declarations, 'orbit', 'bg');
      const orbitText = getSlot(declarations, 'orbit', 'text');
      const mountBg = getSlot(declarations, 'mount', 'bg');
      const baseAltText = getSlot(declarations, 'base', 'alt-text');
      if (
        orbitBorder === null ||
        orbitBg === null ||
        orbitText === null ||
        mountBg === null ||
        baseAltText === null
      ) {
        continue;
      }

      describe(`${fixture.label}`, () => {
        it('orbit-border on mount-bg (selected ring on card) >= 3:1', () => {
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

        it('orbit-text on orbit-bg (selected pill digits) >= 4.5:1', () => {
          const ratio = contrastRatio(
            resolveFg(orbitText),
            compositeOverBg(orbitBg, fixture.pageBg),
          );
          expect
            .soft(
              ratio,
              `orbit-text on orbit-bg (${fixture.label}): got ${describeRatio(ratio)}`,
            )
            .toBeGreaterThanOrEqual(AA_NORMAL);
        });

        it('base-alt-text on mount-bg (unselected pill digits) >= 4.5:1', () => {
          const ratio = contrastRatio(
            resolveFg(baseAltText),
            compositeOverBg(mountBg, fixture.pageBg),
          );
          expect
            .soft(
              ratio,
              `base-alt-text on mount-bg (${fixture.label}): got ${describeRatio(ratio)}`,
            )
            .toBeGreaterThanOrEqual(AA_NORMAL);
        });
      });
    }
  });

  /*
   * Cross-bundle highlight adjacencies - `--{tier}-highlight` painted on a
   * DIFFERENT tier's bg. Per-bundle CONTRACT above covers highlight on its
   * own bg; these four pairs cover the consumer geometries where a highlight
   * slot lives on a foreign host. SC 1.4.11 (3:1) per pair.
   *
   *   1. mount-highlight on base-bg - LinkCardLayout's left accent edge. The
   *      card's `border-l-4` rests on --mount-highlight when fetched, and the
   *      pending color-pulse peaks on --mount-highlight at 50%. That border's
   *      outer edge sits against the page's base-bg (and the placeholder badge,
   *      shifted `-translate-x-1/2`, straddles half onto that same base-bg),
   *      not the card's mount-bg. LinkCardLayout.tsx.
   *   2. orbit-highlight on mount-bg - CvdModeToggle aria-checked capsule
   *      bg painted inside a SettingsGroup mount-host. CvdModeToggle.tsx:78.
   *   3. base-highlight on mount-bg - SettingsGroup data-active=true border
   *      painted on the section's own mount-bg fill (the matching outline
   *      sits on base-bg and is covered by the CONTRACT loop's
   *      `base-highlight on base-bg`). SettingsGroup.tsx:89.
   *   4. base-highlight on orbit-bg - `[data-cvd='on'] [aria-checked='true']`
   *      inset 3px box-shadow bar painted on orbit-host menu items (InlineThemeList
   *      inside MobileBottomSheet). index.css:159-164, InlineThemeList.tsx:28.
   *
   * Pre-flight cleared the matrix worst-case at 3.282:1
   * (mount-highlight on base-bg, before-midnight light).
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
