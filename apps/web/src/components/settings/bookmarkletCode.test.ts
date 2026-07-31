import { buildBookmarkletCode } from './bookmarkletCode';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const API_URL = 'https://api.linklater.example';
const TOKEN = 'ltk_abc123';

describe('buildBookmarkletCode', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_API_BASE_URL', API_URL);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('output shape', () => {
    it('starts with the javascript: scheme', () => {
      expect(buildBookmarkletCode(TOKEN).startsWith('javascript:')).toBe(true);
    });

    it('wraps the body in an immediately-invoked function expression', () => {
      const source = buildBookmarkletCode(TOKEN);
      expect(source).toContain('(function(){');
      expect(source.endsWith('})();')).toBe(true);
    });
  });

  describe('token embedding', () => {
    it('embeds the token as a JSON-stringified value', () => {
      expect(buildBookmarkletCode(TOKEN)).toContain(
        `var t=${JSON.stringify(TOKEN)}`,
      );
    });

    it('escapes double quotes inside the token', () => {
      const tokenWithQuote = 'ltk_with"quote';
      expect(buildBookmarkletCode(tokenWithQuote)).toContain(
        JSON.stringify(tokenWithQuote),
      );
    });

    it('escapes backslashes inside the token', () => {
      const tokenWithBackslash = 'ltk_with\\backslash';
      expect(buildBookmarkletCode(tokenWithBackslash)).toContain(
        JSON.stringify(tokenWithBackslash),
      );
    });

    it('escapes newlines inside the token', () => {
      const tokenWithNewline = 'ltk_with\nnewline';
      expect(buildBookmarkletCode(tokenWithNewline)).toContain(
        JSON.stringify(tokenWithNewline),
      );
    });

    it('produces different output for different tokens', () => {
      const first = buildBookmarkletCode('ltk_first');
      const second = buildBookmarkletCode('ltk_second');
      expect(first).not.toBe(second);
    });
  });

  describe('API URL embedding', () => {
    it('embeds the configured API base URL as a JSON-stringified value', () => {
      expect(buildBookmarkletCode(TOKEN)).toContain(
        `a=${JSON.stringify(API_URL)}`,
      );
    });

    it('targets the /links endpoint', () => {
      expect(buildBookmarkletCode(TOKEN)).toContain("fetch(a+'/links'");
    });

    it('resolves a same-origin relative base to an absolute URL', () => {
      // off-site, a relative /api base hits the host origin; bake absolute
      vi.stubEnv('VITE_API_BASE_URL', '/api');
      const source = buildBookmarkletCode(TOKEN);
      expect(source).toContain(
        `a=${JSON.stringify(`${window.location.origin}/api`)}`,
      );
      expect(source).not.toContain('a="/api"');
    });

    it('leaves an already-absolute base URL unchanged', () => {
      // absolute base (split-domain) is origin-qualified; passes through
      expect(buildBookmarkletCode(TOKEN)).toContain(
        `a=${JSON.stringify(API_URL)}`,
      );
    });
  });

  describe('accessibility attributes on the injected toast', () => {
    it('uses role=status for success notifications', () => {
      expect(buildBookmarkletCode(TOKEN)).toContain("k?'status':'alert'");
    });

    it('uses aria-live=polite for success and assertive for error', () => {
      expect(buildBookmarkletCode(TOKEN)).toContain("k?'polite':'assertive'");
    });
  });

  describe('error handling', () => {
    it('guards the embedded JSON.parse with a try/catch', () => {
      expect(buildBookmarkletCode(TOKEN)).toContain(
        'try{p=JSON.parse(m).message',
      );
      expect(buildBookmarkletCode(TOKEN)).toContain('catch(_){}');
    });

    it('attaches a .catch for network failures', () => {
      expect(buildBookmarkletCode(TOKEN)).toContain(
        ".catch(function(){n('⚠ Could not reach Linklater',false)})",
      );
    });
  });

  describe('fetch request shape', () => {
    it('uses POST', () => {
      expect(buildBookmarkletCode(TOKEN)).toContain("method:'POST'");
    });

    it('sends Authorization Bearer header', () => {
      expect(buildBookmarkletCode(TOKEN)).toContain(
        "'Authorization':'Bearer '+t",
      );
    });

    it('sends Content-Type application/json', () => {
      expect(buildBookmarkletCode(TOKEN)).toContain(
        "'Content-Type':'application/json'",
      );
    });

    it('sends the current page URL in the body', () => {
      expect(buildBookmarkletCode(TOKEN)).toContain(
        'JSON.stringify({url:location.href})',
      );
    });
  });
});
