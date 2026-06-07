import { isSafeRedirectUrl } from './safe-redirect-url.js';

describe('isSafeRedirectUrl', () => {
  describe('returns true for safe URLs', () => {
    it('accepts https:// URLs', () => {
      expect(isSafeRedirectUrl('https://example.com/path')).toBe(true);
    });

    it('accepts http:// URLs', () => {
      expect(isSafeRedirectUrl('http://example.com')).toBe(true);
    });
  });

  describe('returns false for unsafe or non-URL values', () => {
    it('rejects a relative path', () => {
      expect(isSafeRedirectUrl('/dashboard')).toBe(false);
    });

    it('rejects a protocol-relative URL', () => {
      expect(isSafeRedirectUrl('//evil.example.com')).toBe(false);
    });

    it('rejects javascript: scheme', () => {
      expect(isSafeRedirectUrl('javascript:alert(1)')).toBe(false);
    });

    it('rejects data: scheme', () => {
      expect(
        isSafeRedirectUrl('data:text/html,<script>alert(1)</script>'),
      ).toBe(false);
    });

    it('rejects an empty string', () => {
      expect(isSafeRedirectUrl('')).toBe(false);
    });

    it('rejects null', () => {
      expect(isSafeRedirectUrl(null)).toBe(false);
    });

    it('rejects undefined', () => {
      expect(isSafeRedirectUrl(undefined)).toBe(false);
    });

    it('rejects a number', () => {
      expect(isSafeRedirectUrl(42)).toBe(false);
    });

    it('rejects a plain domain without a protocol', () => {
      expect(isSafeRedirectUrl('example.com')).toBe(false);
    });
  });
});
