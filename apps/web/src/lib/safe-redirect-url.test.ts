import { describe, expect, it } from 'vitest';
import { isSafeRedirectUrl } from './safe-redirect-url';

describe('isSafeRedirectUrl', () => {
  it('accepts http:// URLs', () => {
    expect(isSafeRedirectUrl('http://example.com')).toBe(true);
  });

  it('accepts https:// URLs', () => {
    expect(isSafeRedirectUrl('https://example.com/path?query=1')).toBe(true);
  });

  it('rejects javascript: URLs', () => {
    expect(isSafeRedirectUrl('javascript:alert(1)')).toBe(false);
  });

  it('rejects data: URLs', () => {
    expect(isSafeRedirectUrl('data:text/html,<h1>hi</h1>')).toBe(false);
  });

  it('rejects protocol-relative URLs', () => {
    expect(isSafeRedirectUrl('//evil.com')).toBe(false);
  });

  it('rejects relative paths', () => {
    expect(isSafeRedirectUrl('/internal/path')).toBe(false);
  });

  it('rejects empty strings', () => {
    expect(isSafeRedirectUrl('')).toBe(false);
  });

  it('rejects null', () => {
    expect(isSafeRedirectUrl(null)).toBe(false);
  });

  it('rejects undefined', () => {
    expect(isSafeRedirectUrl(undefined)).toBe(false);
  });

  it('rejects non-string values', () => {
    expect(isSafeRedirectUrl(42)).toBe(false);
    expect(isSafeRedirectUrl({})).toBe(false);
  });
});
