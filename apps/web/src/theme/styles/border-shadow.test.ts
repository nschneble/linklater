/*
 * `.border-shadow` and Tailwind's `ring-*` both want the box-shadow
 * property, and an element that carries both keeps only one of them. The
 * elevation shadow used to win, because the stylesheet is imported without
 * a layer and unlayered rules beat every layered one: the static ring-1
 * boundary on the bookmarklet and stumble buttons never painted, and the
 * keyboard selection ring on a settled link card never painted either.
 *
 * Layering the file only reverses the loser. Composing is what lets both
 * paint, so these assert on the composition rather than on the layer.
 */

import { compileIndexCss } from '../../../test/tailwind';
import { describe, expect, it } from 'vitest';

/**
 * Brace-matched, because Tailwind wraps the color-mix values in a nested
 * `@supports` fallback and a slice to the first `}` would stop inside it.
 */
function ruleFor(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`);
  let depth = 0;
  for (let index = css.indexOf('{', start); index < css.length; index += 1) {
    if (css[index] === '{') depth += 1;
    if (css[index] === '}') {
      depth -= 1;
      if (depth === 0) return css.slice(start, index + 1);
    }
  }
  throw new Error(`Unbalanced rule for ${selector}`);
}

describe('border-shadow', () => {
  it('feeds Tailwind shadow slot rather than writing box-shadow outright', async () => {
    const css = await compileIndexCss(['border-shadow']);
    const rule = ruleFor(css, '.border-shadow');
    expect(rule).toContain('--tw-shadow:');
  });

  it('composes the ring slots, so a ring on the same element still paints', async () => {
    const css = await compileIndexCss(['border-shadow']);
    const rule = ruleFor(css, '.border-shadow');
    expect(rule).toContain('var(--tw-ring-shadow)');
    expect(rule).toContain('var(--tw-inset-ring-shadow)');
  });

  it('still emits a box-shadow when nothing else on the element does', async () => {
    const css = await compileIndexCss(['border-shadow']);
    const rule = ruleFor(css, '.border-shadow');
    expect(rule).toContain('box-shadow:');
  });

  it('keeps the dark-mode color override reachable', async () => {
    const css = await compileIndexCss(['border-shadow']);
    expect(css).toContain('--border-shadow-color: #ffffff');
  });
});
