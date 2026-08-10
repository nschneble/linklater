/**
 * The full-screen status surfaces floor their height with `min-h-svh`, the
 * small viewport, rather than `min-h-screen`.
 *
 * `min-h-screen` compiles to `100vh`, and on iOS Safari that is the LARGE
 * viewport: the height the page would have with the browser chrome
 * retracted. A `justify-center` box floored at that height centres its
 * content against a box taller than the area the user can see, so a
 * single-line status message lands below the visible centre while the
 * toolbar is showing. `svh` is the stable small viewport and matches what
 * is actually on screen.
 *
 * `dvh` also tracks the visible area but re-resolves continuously while
 * the toolbar animates, sliding centred content under the reader. That is
 * layout recomputation rather than an animation, so a reduced-motion
 * preference cannot suppress it. These surfaces never scroll, so the
 * stable unit is the correct one.
 *
 * Four things are proved below, and a fifth deliberately is not:
 *
 *   1. The compile check runs both utilities through the project's real
 *      Tailwind and reads the emitted declarations, so neither one can
 *      pass on the strength of its class name alone.
 *   2. The group pin holds the defect itself, one occurrence at a time.
 *      Every floored box in the tree is sorted by whether it centres and
 *      by which viewport it floors on, and each of the four groups is
 *      matched against the box it is supposed to hold. A box that changes
 *      either half of that pairing lands in a group that does not expect
 *      it, which is what catches a surface reaching for a unit nobody
 *      listed, a wrapper picking up centring while keeping the floor it
 *      has, and two boxes in one file trading floors.
 *   3. Two whole-file scans count the same floors a second way, reading
 *      raw text rather than parsed class attributes. That is what still
 *      sees a floor hoisted into a constant, where the group pin, which
 *      only ever looks inside a class attribute, sees nothing.
 *   4. An absence scan bans the sibling spellings of the same floor.
 *      Every scan here matches a whole class, so a banned exact height is
 *      never read out of the legal floor it is a suffix of, and the ban
 *      reaches floors alone: the links dropdown caps its own scrolling
 *      height against the dynamic viewport, and has to keep doing so.
 *   5. None of them measures geometry. Headless browsers have no
 *      retracting chrome, so `vh`, `svh`, `lvh` and `dvh` all resolve
 *      identically there and no automated check can observe the defect.
 *      The centring is confirmable only on a real iOS device.
 *
 * Every scan skips test files, which carry these utilities as assertion
 * literals rather than to lay anything out and never reach a browser.
 */

import {
  CENTRED_LARGE_VIEWPORT_FLOORS,
  CENTRED_SMALL_VIEWPORT_FLOORS,
  flooredBoxes,
  floorOccurrences,
  PINNED_LARGE_FLOOR,
  PINNED_SMALL_FLOOR,
  SIBLING_FLOOR_UTILITIES,
  UNCENTRED_LARGE_VIEWPORT_FLOORS,
} from './status-surface-viewport.utils';
import { compile } from 'tailwindcss';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { dirname, resolve } from 'node:path';
import { readFileSync } from 'node:fs';

const requireFromHere = createRequire(import.meta.url);

/**
 * Resolves `@import "tailwindcss";` (and its relative sub-imports) off
 * disk so the compiler can register core variants + utilities. The same
 * helper already sits in `components/settings/SettingSwitch.test.tsx`,
 * `components/legal/policyMarkdownComponents.test.tsx` and
 * `components/links/LinkCard/index.test.tsx`.
 */
function loadStylesheet(id: string, base: string) {
  const path =
    id === 'tailwindcss'
      ? resolve(
          dirname(requireFromHere.resolve('tailwindcss/package.json')),
          'index.css',
        )
      : resolve(base, id);
  return { base: dirname(path), content: readFileSync(path, 'utf8'), path };
}

/** Compiles utility classes through the real Tailwind pipeline. */
async function compileClasses(classes: string[]): Promise<string> {
  const compiler = await compile('@import "tailwindcss";', {
    base: process.cwd(),
    loadStylesheet,
  });
  return compiler.build(classes);
}

/** Reads the `min-height` a compiled utility declares, null if absent. */
function declaredMinHeight(css: string, utility: string): string | null {
  const rule = new RegExp(`\\.${utility}\\s*\\{\\s*min-height:\\s*([^;]+);`);
  const match = rule.exec(css);
  return match === null ? null : match[1].trim();
}

/*
 * The swap applies to a box that vertically centres its content against
 * a viewport floor, so a centring utility together with `min-h-*`. The
 * centring is what makes the unit observable at all.
 *
 * The gradient auth-card wrappers centre too, and four of the five are
 * untreated: they floor on the large viewport with nothing standing in
 * for the swap. Only routes/Unauthenticated.tsx carries a mitigation,
 * top-aligning with padding below `sm` so a short card cannot lose its
 * head, and that one is pinned in routes/Unauthenticated.test.tsx. The
 * two wrappers in ResetPasswordPage and the two in
 * ExtensionAuthorizePage have neither. Their unit is left to the owner
 * rather than swept: a shorter wrapper changes how far the gradient
 * runs, which is a visual call and not a mechanical one.
 *
 * A `min-h-*` that centres nothing also stays on `min-h-screen`, and the
 * reason is narrow: with nothing centred the unit is unobservable, so
 * changing it would be diff without effect. It is not that the large
 * viewport is the right floor for painting. index.html puts the
 * background on `<body>`, which propagates to the canvas and paints the
 * full viewport whatever the document height turns out to be. That
 * covers AppShell, LandingPage, PolicyDocumentPage, ApiDocsView and the
 * outer wrapper in FailWhalePage.
 */

describe('viewport units the status surfaces compile to', () => {
  it('emits 100svh for min-h-svh and 100vh for min-h-screen', async () => {
    const css = await compileClasses(['min-h-svh', 'min-h-screen']);

    expect(declaredMinHeight(css, 'min-h-svh')).toBe('100svh');
    expect(declaredMinHeight(css, 'min-h-screen')).toBe('100vh');
  });
});

describe('every floored box sits in the group that expects it', () => {
  it('centres against the small viewport in exactly the pinned places', () => {
    expect(flooredBoxes('centred-small')).toEqual(
      [...CENTRED_SMALL_VIEWPORT_FLOORS].sort(),
    );
  });

  it('centres against a larger viewport only in the gradient wrappers', () => {
    expect(flooredBoxes('centred-large')).toEqual(
      [...CENTRED_LARGE_VIEWPORT_FLOORS].sort(),
    );
  });

  it('paints a larger viewport under exactly the boxes that centre none', () => {
    expect(flooredBoxes('uncentred-large')).toEqual(
      [...UNCENTRED_LARGE_VIEWPORT_FLOORS].sort(),
    );
  });

  it('never spends the small viewport on a box that centres nothing', () => {
    expect(flooredBoxes('uncentred-small')).toEqual([]);
  });
});

describe('the tables account for every floor written under src', () => {
  it('finds no min-h-svh the groups above have not already claimed', () => {
    expect(floorOccurrences(PINNED_SMALL_FLOOR)).toEqual(
      [...CENTRED_SMALL_VIEWPORT_FLOORS].sort(),
    );
  });

  it('finds no min-h-screen the groups above have not already claimed', () => {
    expect(floorOccurrences(PINNED_LARGE_FLOOR)).toEqual(
      [
        ...CENTRED_LARGE_VIEWPORT_FLOORS,
        ...UNCENTRED_LARGE_VIEWPORT_FLOORS,
      ].sort(),
    );
  });

  it.each(SIBLING_FLOOR_UTILITIES)('no source file floors on %s', (utility) => {
    expect(floorOccurrences(utility)).toEqual([]);
  });
});
