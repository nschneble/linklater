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
 * Three things are proved below, and a fourth deliberately is not:
 *
 *   1. The compile check runs both utilities through the project's real
 *      Tailwind and reads the emitted declarations, so neither one can
 *      pass on the strength of its class name alone.
 *   2. The surface pin counts both utilities in each listed file, holding
 *      the swap in place against a later edit.
 *   3. Two scans of the source tree hold the pinned set closed in both
 *      units, so a file that picks up either utility without being
 *      listed, or a listed file that quietly loses one, fails the suite.
 *      The large-viewport half is what keeps a newly written surface from
 *      reaching `main` on `min-h-screen` unremarked.
 *   4. None of them measures geometry. Headless browsers have no
 *      retracting chrome, so `vh`, `svh`, `lvh` and `dvh` all resolve
 *      identically there and no automated check can observe the defect.
 *      The centring is confirmable only on a real iOS device.
 */

import { compile } from 'tailwindcss';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { dirname, resolve } from 'node:path';
import {
  filesUsing,
  readSource,
  SURFACES,
  surfacesUsing,
} from './status-surface-viewport.pins';
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

function countOccurrences(source: string, needle: string): number {
  return source.split(needle).length - 1;
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
 *
 * Both counts are pinned per file, which is what holds the two files
 * deliberately carrying both units. ResetPasswordPage keeps its two
 * gradient wrappers and FailWhalePage keeps its outer one, so a later
 * sweep cannot quietly take them either.
 */

describe('viewport units the status surfaces compile to', () => {
  it('emits 100svh for min-h-svh and 100vh for min-h-screen', async () => {
    const css = await compileClasses(['min-h-svh', 'min-h-screen']);

    expect(declaredMinHeight(css, 'min-h-svh')).toBe('100svh');
    expect(declaredMinHeight(css, 'min-h-screen')).toBe('100vh');
  });
});

describe('the pinned surfaces are the only viewport-floored files', () => {
  it('lists every file under src that uses min-h-svh, and no others', () => {
    expect(filesUsing('min-h-svh')).toEqual(surfacesUsing('svh'));
  });

  it('lists every file under src that uses min-h-screen, and no others', () => {
    expect(filesUsing('min-h-screen')).toEqual(surfacesUsing('screen'));
  });

  it.each(Object.entries(SURFACES))(
    '%s holds the pinned count of each floor',
    (relativePath, counts) => {
      const source = readSource(relativePath);

      expect(countOccurrences(source, 'min-h-svh')).toBe(counts.svh);
      expect(countOccurrences(source, 'min-h-screen')).toBe(counts.screen);
    },
  );
});
