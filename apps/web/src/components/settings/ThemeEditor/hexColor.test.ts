/*
 * Tests for the Theme Editor's hex/color-value helpers.
 *
 * Focus: `normalizeToSixDigitHex` accepts hex codes WITHOUT the `#` prefix and
 * adds it (Postel's Law), then expands 3-digit shorthand to 6-digit — all
 * BEFORE validation runs, so a `#`-less hex never reads as invalid. `rgb()` and
 * 8-digit alpha hex pass through untouched; true garbage stays invalid.
 */

import { describe, expect, it } from 'vitest';
import { isValidColorValue, normalizeToSixDigitHex } from './hexColor';

describe('normalizeToSixDigitHex – # prefix is optional (Postel’s Law)', () => {
  it('prepends # to a bare 6-digit hex body', () => {
    expect(normalizeToSixDigitHex('aabbcc')).toBe('#aabbcc');
  });

  it('prepends # to a bare 3-digit hex body and expands it to 6-digit', () => {
    expect(normalizeToSixDigitHex('abc')).toBe('#aabbcc');
  });

  it('is case-insensitive for bare hex', () => {
    expect(normalizeToSixDigitHex('ABC')).toBe('#aabbcc');
    expect(normalizeToSixDigitHex('AABBCC')).toBe('#aabbcc');
  });

  it('trims surrounding whitespace before prepending', () => {
    expect(normalizeToSixDigitHex('  aabbcc  ')).toBe('#aabbcc');
  });

  it('leaves an already-prefixed hex unchanged (6-digit)', () => {
    expect(normalizeToSixDigitHex('#aabbcc')).toBe('#aabbcc');
  });

  it('still expands an already-prefixed 3-digit shorthand', () => {
    expect(normalizeToSixDigitHex('#abc')).toBe('#aabbcc');
  });

  it('leaves rgb()/rgba() expressions untouched', () => {
    expect(normalizeToSixDigitHex('rgb(76 5 25 / 0.4)')).toBe(
      'rgb(76 5 25 / 0.4)',
    );
    expect(normalizeToSixDigitHex('rgba(0, 0, 0, 0.5)')).toBe(
      'rgba(0, 0, 0, 0.5)',
    );
  });

  it('does not rescue an 8-digit alpha hex body that lacks a #', () => {
    // out of scope: only bare 3/6-digit bodies get a `#`
    expect(normalizeToSixDigitHex('aabbccdd')).toBe('aabbccdd');
  });

  it('leaves true garbage untouched so validation can reject it', () => {
    expect(normalizeToSixDigitHex('zzz')).toBe('zzz');
    expect(normalizeToSixDigitHex('hello')).toBe('hello');
    expect(normalizeToSixDigitHex('gggggg')).toBe('gggggg');
    expect(normalizeToSixDigitHex('#12')).toBe('#12');
  });
});

describe('normalize-before-validate – the round-trip the editor relies on', () => {
  it('makes a #-less hex valid after normalization', () => {
    expect(isValidColorValue(normalizeToSixDigitHex('aabbcc'))).toBe(true);
    expect(isValidColorValue(normalizeToSixDigitHex('abc'))).toBe(true);
    expect(isValidColorValue(normalizeToSixDigitHex('ABC'))).toBe(true);
  });

  it('keeps an 8-digit alpha hex valid', () => {
    expect(isValidColorValue('#aabbccdd')).toBe(true);
    expect(isValidColorValue(normalizeToSixDigitHex('#aabbccdd'))).toBe(true);
  });

  it('keeps true garbage invalid after normalization', () => {
    expect(isValidColorValue(normalizeToSixDigitHex('zzz'))).toBe(false);
    expect(isValidColorValue(normalizeToSixDigitHex('hello'))).toBe(false);
    expect(isValidColorValue(normalizeToSixDigitHex('gggggg'))).toBe(false);
    expect(isValidColorValue(normalizeToSixDigitHex('#12'))).toBe(false);
    expect(isValidColorValue(normalizeToSixDigitHex('##aabbcc'))).toBe(false);
  });
});
