/**
 * Guards the one place the contrast suites can lie.
 *
 * `resolveFg` used to drop a foreground's alpha and hand back the remaining
 * channels, which turns a translucent color into a measurement of a color
 * nobody can see, reported as a PASS. Every shipped foreground slot is opaque
 * today, so the throw cannot fire; this pins that it WILL fire the moment
 * that stops being true.
 */

import { describe, expect, it } from 'vitest';
import {
  compositeOverBg,
  contrastRatio,
  parseColor,
  resolveFg,
} from './bundles-color-utils';

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
