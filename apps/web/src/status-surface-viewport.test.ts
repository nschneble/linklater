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
 *   2. The surface pin counts the utilities in each source file, holding
 *      the swap in place against a later edit.
 *   3. A scan of the source tree holds the pinned set closed, so a file
 *      that picks up `min-h-svh` without being listed, or a listed file
 *      that quietly loses it, fails the suite.
 *   4. None of them measures geometry. Headless browsers have no
 *      retracting chrome, so `vh`, `svh`, `lvh` and `dvh` all resolve
 *      identically there and no automated check can observe the defect.
 *      The centring is confirmable only on a real iOS device.
 */

import { compile } from 'tailwindcss';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdirSync, readFileSync } from 'node:fs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

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
 * The gradient auth-card wrappers are the exception to that rule. They
 * do centre, but the gradient must not be shrunk, so their fix is
 * top-alignment plus padding rather than a shorter wrapper, and they
 * stay on `min-h-screen`. Pinned in routes/Unauthenticated.test.tsx.
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
 * `largeViewport` is how much `min-h-screen` the file should still hold,
 * which pins the two files that deliberately carry both units.
 * ResetPasswordPage keeps its two gradient wrappers and FailWhalePage
 * keeps its outer one, so a later sweep cannot quietly take them too.
 */
const SURFACES = [
  { relativePath: 'src/App.tsx', smallViewport: 1, largeViewport: 0 },
  { relativePath: 'src/routes/Common.tsx', smallViewport: 1, largeViewport: 0 },
  {
    relativePath: 'src/components/verify/TokenVerificationPage.tsx',
    smallViewport: 1,
    largeViewport: 0,
  },
  {
    relativePath: 'src/components/auth/VerifyLoginPage.tsx',
    smallViewport: 1,
    largeViewport: 0,
  },
  {
    relativePath: 'src/components/auth/ResetPasswordPage.tsx',
    smallViewport: 1,
    largeViewport: 2,
  },
  {
    relativePath: 'src/components/auth/OAuthCallbackPage.tsx',
    smallViewport: 1,
    largeViewport: 0,
  },
  {
    relativePath: 'src/components/auth/ConfirmAccountDeletionPage.tsx',
    smallViewport: 1,
    largeViewport: 0,
  },
  {
    relativePath: 'src/components/stumble/StumblePage.tsx',
    smallViewport: 2,
    largeViewport: 0,
  },
  {
    relativePath: 'src/components/stumble/StumbleEmptyView.tsx',
    smallViewport: 1,
    largeViewport: 0,
  },
  {
    relativePath: 'src/components/errors/ErrorBoundary.tsx',
    smallViewport: 1,
    largeViewport: 0,
  },
  {
    relativePath: 'src/components/errors/NotFoundView.tsx',
    smallViewport: 1,
    largeViewport: 0,
  },
  {
    relativePath: 'src/components/FailWhalePage/index.tsx',
    smallViewport: 1,
    largeViewport: 1,
  },
] as const;

const THIS_FILE = 'src/status-surface-viewport.test.ts';

/**
 * Every file under `src` holding `min-h-svh`, this one aside: it carries
 * the literal to assert on rather than to lay out anything.
 */
function filesUsingSmallViewport(): string[] {
  return readdirSync(resolve(ROOT, 'src'), {
    recursive: true,
    withFileTypes: true,
  })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(ROOT, resolve(entry.parentPath, entry.name)))
    .filter((path) => path !== THIS_FILE)
    .filter((path) =>
      readFileSync(resolve(ROOT, path), 'utf8').includes('min-h-svh'),
    )
    .sort();
}

describe('viewport units the status surfaces compile to', () => {
  it('emits 100svh for min-h-svh and 100vh for min-h-screen', async () => {
    const css = await compileClasses(['min-h-svh', 'min-h-screen']);

    expect(declaredMinHeight(css, 'min-h-svh')).toBe('100svh');
    expect(declaredMinHeight(css, 'min-h-screen')).toBe('100vh');
  });
});

describe('full-screen status surfaces floor on the small viewport', () => {
  it('lists every file under src that uses min-h-svh, and no others', () => {
    const listed = SURFACES.map((surface) => surface.relativePath).sort();

    expect(filesUsingSmallViewport()).toEqual(listed);
  });

  it.each(SURFACES)(
    '$relativePath uses min-h-svh $smallViewport time(s)',
    ({ relativePath, smallViewport, largeViewport }) => {
      const source = readFileSync(resolve(ROOT, relativePath), 'utf8');

      expect(countOccurrences(source, 'min-h-svh')).toBe(smallViewport);
      expect(countOccurrences(source, 'min-h-screen')).toBe(largeViewport);
    },
  );
});
