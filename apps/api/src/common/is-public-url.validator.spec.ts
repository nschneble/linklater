import { IsPublicUrlConstraint } from './is-public-url.validator.js';
import type { HostResolver } from './safe-fetch.js';

// these inputs short-circuit before the resolver; throwing guards that
const throwingResolver: HostResolver = () => {
  throw new Error('resolver should not be called for this input');
};

describe('IsPublicUrlConstraint', () => {
  const constraint = new IsPublicUrlConstraint(throwingResolver);

  describe('rejects non-string and unparseable input', () => {
    it('rejects non-string values', async () => {
      expect(await constraint.validate(undefined)).toBe(false);
      expect(await constraint.validate(null)).toBe(false);
      expect(await constraint.validate(42)).toBe(false);
      expect(await constraint.validate({})).toBe(false);
    });

    it('rejects strings that cannot be parsed as a URL', async () => {
      expect(await constraint.validate('not a url')).toBe(false);
      expect(await constraint.validate('')).toBe(false);
    });
  });

  describe('rejects non-http(s) schemes (defence-in-depth)', () => {
    it('rejects javascript:', async () => {
      expect(await constraint.validate('javascript:alert(1)')).toBe(false);
    });

    it('rejects data:', async () => {
      expect(await constraint.validate('data:text/html,<h1>x</h1>')).toBe(
        false,
      );
    });

    it('rejects file:', async () => {
      expect(await constraint.validate('file:///etc/passwd')).toBe(false);
    });

    it('rejects ftp:', async () => {
      expect(await constraint.validate('ftp://example.com/file')).toBe(false);
    });
  });

  describe('rejects private/loopback hosts (literals, no DNS)', () => {
    it('rejects http://localhost', async () => {
      expect(await constraint.validate('http://localhost')).toBe(false);
    });

    it('rejects http://127.0.0.1', async () => {
      expect(await constraint.validate('http://127.0.0.1')).toBe(false);
    });

    it('rejects http://0.0.0.0', async () => {
      expect(await constraint.validate('http://0.0.0.0')).toBe(false);
    });

    it('rejects http://192.168.1.1', async () => {
      expect(await constraint.validate('http://192.168.1.1')).toBe(false);
    });
  });

  describe('accepts public http(s) URLs', () => {
    it('accepts a public IP literal (no DNS resolution)', async () => {
      expect(await constraint.validate('https://93.184.216.34')).toBe(true);
    });

    it('accepts a hostname that resolves to a public IP', async () => {
      const publicConstraint = new IsPublicUrlConstraint(async () => [
        '93.184.216.34',
      ]);
      expect(await publicConstraint.validate('https://example.com')).toBe(true);
      expect(await publicConstraint.validate('http://example.com/path')).toBe(
        true,
      );
    });

    it('allows a hostname that cannot be resolved (fetch-time guard covers it)', async () => {
      const failingConstraint = new IsPublicUrlConstraint(async () => {
        throw new Error('ENOTFOUND');
      });
      expect(
        await failingConstraint.validate('https://not-registered.example'),
      ).toBe(true);
    });
  });

  describe('SSRF DNS bypass – hostname resolving to a private IP', () => {
    it('rejects a public hostname whose record points at the AWS metadata IP', async () => {
      const rebindingConstraint = new IsPublicUrlConstraint(async () => [
        '169.254.169.254',
      ]);
      expect(
        await rebindingConstraint.validate('https://metadata.attacker.example'),
      ).toBe(false);
    });

    it('rejects a public hostname resolving to an RFC 1918 address', async () => {
      const rebindingConstraint = new IsPublicUrlConstraint(async () => [
        '10.0.0.5',
      ]);
      expect(
        await rebindingConstraint.validate('https://internal.attacker.example'),
      ).toBe(false);
    });
  });
});
