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

/*
 * The parse boundary is the only place a value can be refused. Everything
 * downstream treats a returned tuple as a successful read, and a not-a-number
 * channel survives every later guard: a comparison against it is false, so it
 * becomes the worst ratio, and the worst ratio is then not below threshold, so
 * the palette rolls up as conforming. An out-of-range channel is worse still,
 * because it yields a confident number no display can produce.
 */
describe('parseColor refuses what it cannot honestly measure', () => {
  it('rejects a body of the right length made of non-hex characters', () => {
    expect(() => parseColor('#zzzzzz')).toThrow(/hex/);
    expect(() => parseColor('#gggggggg')).toThrow(/hex/);
  });

  it('rejects a channel past the top of the 8-bit range', () => {
    // this one reported 457:1, well past the 21:1 ceiling of the formula
    expect(() => parseColor('rgb(999, 999, 999)')).toThrow(/rgb/);
    expect(() => parseColor('rgb(0 0 256)')).toThrow(/rgb/);
  });

  it('rejects an alpha outside the unit interval', () => {
    expect(() => parseColor('rgba(0, 0, 0, 4)')).toThrow(/rgb/);
  });

  it('rejects an alpha that is not a number at all', () => {
    expect(() => parseColor('rgb(0 0 0 / 1.2.3)')).toThrow(/rgb/);
  });

  it('still accepts every form the stylesheets and seeds are written in', () => {
    expect(parseColor('rgb(23 37 84 / 0.55)')).toEqual([23, 37, 84, 0.55]);
    expect(parseColor('rgba(0, 0, 0, 0.5)')).toEqual([0, 0, 0, 0.5]);
    expect(parseColor('#eeeede')).toEqual([238, 238, 222, 1]);
    expect(parseColor('#abc')).toEqual([170, 187, 204, 1]);
    expect(parseColor('#ffffff0d')).toEqual([255, 255, 255, 13 / 255]);
  });
});

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
