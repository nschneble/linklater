import { describe, expect, it } from 'vitest';
import { formatTotpCode, normalizeTotpInput } from './totpCode';

describe('normalizeTotpInput', () => {
  it('returns digits unchanged when input is already six digits', () => {
    expect(normalizeTotpInput('123456')).toBe('123456');
  });

  it('strips a single space between digit groups', () => {
    expect(normalizeTotpInput('123 456')).toBe('123456');
  });

  it('strips surrounding whitespace from a pasted code', () => {
    expect(normalizeTotpInput('  123456  ')).toBe('123456');
  });

  it('strips hyphens and other punctuation', () => {
    expect(normalizeTotpInput('123-456')).toBe('123456');
  });

  it('strips letters mixed into the input', () => {
    expect(normalizeTotpInput('abc123456def')).toBe('123456');
  });

  it('caps the result at six digits when more are pasted', () => {
    expect(normalizeTotpInput('1234567890')).toBe('123456');
  });

  it('returns an empty string when the input has no digits', () => {
    expect(normalizeTotpInput('   ')).toBe('');
  });

  it('preserves partial input while typing', () => {
    expect(normalizeTotpInput('12')).toBe('12');
    expect(normalizeTotpInput('1234')).toBe('1234');
  });
});

describe('formatTotpCode', () => {
  it('returns an empty string unchanged', () => {
    expect(formatTotpCode('')).toBe('');
  });

  it('returns three or fewer digits unchanged', () => {
    expect(formatTotpCode('1')).toBe('1');
    expect(formatTotpCode('12')).toBe('12');
    expect(formatTotpCode('123')).toBe('123');
  });

  it('inserts a space after the third digit once four digits are present', () => {
    expect(formatTotpCode('1234')).toBe('123 4');
  });

  it('formats a full six-digit code as "XXX XXX"', () => {
    expect(formatTotpCode('123456')).toBe('123 456');
  });

  it('formats a partial four- or five-digit code', () => {
    expect(formatTotpCode('12345')).toBe('123 45');
  });
});
