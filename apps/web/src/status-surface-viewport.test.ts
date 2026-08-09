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
 * Two things are proved below, and a third deliberately is not:
 *
 *   1. The compile check runs both utilities through the project's real
 *      Tailwind and reads the emitted declarations, so neither one can
 *      pass on the strength of its class name alone.
 *   2. The surface pin counts the utilities in each source file, holding
 *      the swap in place against a later edit.
 *   3. Neither check measures geometry. Headless browsers have no
 *      retracting chrome, so `vh`, `svh`, `lvh` and `dvh` all resolve
 *      identically there and no automated check can observe the defect.
 *      The centring is confirmable only on a real iOS device.
 */

import { compile } from 'tailwindcss';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const requireFromHere = createRequire(import.meta.url);

/**
 * Resolves `@import "tailwindcss";` (and its relative sub-imports) off
 * disk so the compiler can register core variants + utilities. Mirrors
 * the helper in `components/settings/SettingSwitch.test.tsx`.
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
 * Every surface that centres transient status content in a full-height
 * box.
 *
 * `largeViewport` is how much `min-h-screen` the file should still hold.
 * ResetPasswordPage keeps two: its gradient auth-card wrappers, which
 * share a constraint with the login card (the gradient must not be
 * shrunk, so their fix is top-alignment plus padding, never a smaller
 * wrapper) and are left for that separate decision. See
 * routes/Unauthenticated.test.tsx.
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
] as const;

const EXPECTED_SMALL_VIEWPORT_TOTAL = 10;

describe('viewport units the status surfaces compile to', () => {
  it('emits 100svh for min-h-svh and 100vh for min-h-screen', async () => {
    const css = await compileClasses(['min-h-svh', 'min-h-screen']);

    expect(declaredMinHeight(css, 'min-h-svh')).toBe('100svh');
    expect(declaredMinHeight(css, 'min-h-screen')).toBe('100vh');
  });
});

describe('full-screen status surfaces floor on the small viewport', () => {
  it('covers every surface the swap touched', () => {
    const total = SURFACES.reduce(
      (running, surface) => running + surface.smallViewport,
      0,
    );
    expect(total).toBe(EXPECTED_SMALL_VIEWPORT_TOTAL);
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
