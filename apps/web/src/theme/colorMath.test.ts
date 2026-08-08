/*
 * Tests for the blend itself, separate from anything that consumes it.
 *
 * Compositing is easy to get wrong in a way that still looks right: both the
 * source-over weights and the group-flatten weights sum to 1, so a wrong blend
 * stays in gamut and returns a plausible number. The assertions here are
 * hand-computed from the CSS Compositing and Blending Level 1 formula rather
 * than recorded from a run.
 */

import { compositeOver, compositeOverBg, parseColor } from './colorMath';
import { describe, expect, it } from 'vitest';

describe('compositeOver', () => {
  it('accumulates alpha as a_s + a_b(1 - a_s)', () => {
    // 0.5 + 0.5(1 - 0.5) = 0.75, not either operand's alpha
    const composited = compositeOver([255, 255, 255, 0.5], [0, 0, 0, 0.5]);

    expect(composited[3]).toBeCloseTo(0.75, 10);
    // (255 x 0.5 + 0 x 0.5 x 0.5) / 0.75
    expect(composited[0]).toBeCloseTo(170, 10);
  });

  it('blends in gamma-encoded sRGB, the space the browser composites in', () => {
    // WCAG linearizes later, in relativeLuminance. Linearizing first would
    // put 50% black over white at 188 instead of 128
    const composited = compositeOver([0, 0, 0, 0.5], [255, 255, 255, 1]);

    expect(composited[0]).toBeCloseTo(127.5, 10);
  });

  it('carries alpha down a stack of two translucent layers', () => {
    // a status background on a near-transparent card on an opaque page
    const card = compositeOver(
      parseColor('#909090e0'),
      parseColor('#40404010'),
    );
    expect(card[3]).toBeCloseTo(0.8860592079969243, 12);
    expect(card[0]).toBeCloseTo(143.31130241599556, 10);

    const onPage = compositeOver(card, parseColor('#000000'));
    expect(onPage[3]).toBe(1);
    expect(onPage[0]).toBeCloseTo(126.98229911572473, 10);
  });

  it('leaves a fully transparent stack transparent rather than dividing by zero', () => {
    expect(compositeOver([10, 20, 30, 0], [40, 50, 60, 0])).toEqual([
      0, 0, 0, 0,
    ]);
  });
});

describe('compositeOverBg', () => {
  it('is compositeOver against an opaque backdrop, rounded', () => {
    const translucent = parseColor('#909090e0');
    const exact = compositeOver(translucent, [64, 64, 64, 1]);

    expect(compositeOverBg(translucent, [64, 64, 64])).toEqual([
      Math.round(exact[0]),
      Math.round(exact[1]),
      Math.round(exact[2]),
    ]);
  });

  it('passes an opaque foreground through untouched', () => {
    expect(compositeOverBg([17, 34, 51, 1], [255, 255, 255])).toEqual([
      17, 34, 51,
    ]);
  });
});
