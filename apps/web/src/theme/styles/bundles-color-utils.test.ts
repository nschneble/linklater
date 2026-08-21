/**
 * Guards the two places the contrast suites can lie: `resolveFg` dropping a
 * foreground's alpha and reporting a color nobody can see as a PASS, and
 * `parseDeclarations` reading a declaration out of a CSS comment, then eating
 * the real declaration that follows it.
 */

import {
  compositeOverBg,
  contrastRatio,
  parseColor,
  parseDeclarations,
  resolveFg,
} from './bundles-color-utils';
import { describe, expect, it } from 'vitest';

describe('resolveFg', () => {
  it('passes an opaque color straight through', () => {
    expect(resolveFg(parseColor('#eeeede'))).toEqual([238, 238, 222]);
  });

  it.each([
    ['8-digit hex', '#eeeede40'],
    ['rgba()', 'rgba(238, 238, 222, 0.25)'],
  ])('refuses a translucent color given as %s', (_label, value) => {
    expect(() => resolveFg(parseColor(value))).toThrow(/translucent/);
  });

  it('names compositeOverBg as the fix', () => {
    expect(() => resolveFg(parseColor('#eeeede40'))).toThrow(/compositeOverBg/);
  });

  it('would have reported a false pass on the value it now refuses', () => {
    // the exact shape of the old bug: a barely-visible text color measured
    // as though it were fully opaque
    const darkCard = compositeOverBg(parseColor('#1a1a1a'), [0, 0, 0]);
    const droppedAlpha = contrastRatio([238, 238, 222], darkCard);
    const trueRatio = contrastRatio(
      compositeOverBg(parseColor('#eeeede40'), darkCard),
      darkCard,
    );

    expect(droppedAlpha).toBeGreaterThan(4.5);
    expect(trueRatio).toBeLessThan(4.5);
  });
});

describe('parseDeclarations', () => {
  it('reads past a comment that carries token-shaped text', () => {
    const block = `
      --warn-alt-text: #5a3814;
      /* CHANGED: was #a06820 - cannot host any safe fg at >=4.5:1.
       * Bumped to #8a5c1f so --warn-highlight-fg: #ffffff
       * clears at 5.78:1. */
      --warn-highlight: #8a5c1f;
      --warn-highlight-fg: #ffffff;
    `;

    expect(parseDeclarations(block).get('warn-highlight')).toBe('#8a5c1f');
  });

  it('leaves a commented-out declaration undefined', () => {
    const block = `
      --warn-bg: #f5e3c2;
      /* --warn-border: #8a5c1f; */
    `;

    expect(parseDeclarations(block).has('warn-border')).toBe(false);
  });

  it('stops a value at the next declaration when a semicolon is missing', () => {
    const block = `
      --warn-bg: #f5e3c2
      --warn-border: #8a5c1f;
    `;

    expect(parseDeclarations(block).get('warn-border')).toBe('#8a5c1f');
  });

  it('keeps a value that wraps across lines', () => {
    const block = `
      --tw-shadow:
        0px 0px 0px 1px
        color-mix(in srgb, var(--border-shadow-color) 40%, transparent);
    `;
    const value = parseDeclarations(block).get('tw-shadow');

    expect(value).toContain('color-mix');
    expect(value).toContain('var(--border-shadow-color)');
  });
});
