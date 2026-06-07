import { IsPublicUrlConstraint } from './is-public-url.validator.js';

describe('IsPublicUrlConstraint', () => {
  const constraint = new IsPublicUrlConstraint();

  describe('rejects non-string and unparseable input', () => {
    it('rejects non-string values', () => {
      expect(constraint.validate(undefined)).toBe(false);
      expect(constraint.validate(null)).toBe(false);
      expect(constraint.validate(42)).toBe(false);
      expect(constraint.validate({})).toBe(false);
    });

    it('rejects strings that cannot be parsed as a URL', () => {
      expect(constraint.validate('not a url')).toBe(false);
      expect(constraint.validate('')).toBe(false);
    });
  });

  describe('rejects non-http(s) schemes (defence-in-depth)', () => {
    it('rejects javascript:', () => {
      expect(constraint.validate('javascript:alert(1)')).toBe(false);
    });

    it('rejects data:', () => {
      expect(constraint.validate('data:text/html,<h1>x</h1>')).toBe(false);
    });

    it('rejects file:', () => {
      expect(constraint.validate('file:///etc/passwd')).toBe(false);
    });

    it('rejects ftp:', () => {
      expect(constraint.validate('ftp://example.com/file')).toBe(false);
    });
  });

  describe('rejects private/loopback hosts', () => {
    it('rejects http://localhost', () => {
      expect(constraint.validate('http://localhost')).toBe(false);
    });

    it('rejects http://127.0.0.1', () => {
      expect(constraint.validate('http://127.0.0.1')).toBe(false);
    });

    it('rejects http://0.0.0.0', () => {
      expect(constraint.validate('http://0.0.0.0')).toBe(false);
    });

    it('rejects http://192.168.1.1', () => {
      expect(constraint.validate('http://192.168.1.1')).toBe(false);
    });
  });

  describe('accepts public http(s) URLs', () => {
    it('accepts https://example.com', () => {
      expect(constraint.validate('https://example.com')).toBe(true);
    });

    it('accepts http://example.com/path', () => {
      expect(constraint.validate('http://example.com/path')).toBe(true);
    });

    it('accepts public DNS hosts that start with "fc" (not IPv6 ULA)', () => {
      expect(constraint.validate('https://fcc.gov')).toBe(true);
    });
  });
});
