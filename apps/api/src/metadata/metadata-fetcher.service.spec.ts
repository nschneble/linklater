import { jest } from '@jest/globals';

import { Test, TestingModule } from '@nestjs/testing';
import type { MetadataFetcherService } from './metadata-fetcher.service';

// mock undici (safeFetch's fetch source) via unstable_mockModule + dynamic import, forwarding to global.fetch
const undiciFetchMock = jest.fn();
jest.unstable_mockModule('undici', () => ({
  Agent: class {},
  fetch: undiciFetchMock,
}));
undiciFetchMock.mockImplementation(
  (input: string | URL | Request, init?: RequestInit) =>
    global.fetch(input, init),
);

const { MetadataFetcherService: MetadataFetcherServiceClass } =
  await import('./metadata-fetcher.service');

/** Points global.fetch at a 200 text/html response carrying `html`. */
const mockFetchHtml = (html: string) => {
  const bytes = new TextEncoder().encode(html);
  global.fetch = jest.fn().mockResolvedValue({
    status: 200,
    headers: {
      get: (key: string) =>
        key.toLowerCase() === 'content-type' ? 'text/html' : null,
    },
    ok: true,
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    }),
  }) as unknown as typeof fetch;
};

/**
 * Builds a minimal fetch mock that returns a valid HTML response. Used to
 * confirm a URL passes the SSRF guard (i.e. a fetch mock being called means
 * the guard allowed the request through).
 */
const mockFetchSuccess = () => {
  mockFetchHtml('<html><head><title>Test</title></head><body></body></html>');
};

const mockFetchReject = () => {
  // never-settling mock: SSRF guard blocks fetch, and this avoids unhandled-rejection noise
  global.fetch = jest
    .fn()
    .mockReturnValue(new Promise(() => {})) as unknown as typeof fetch;
};

describe('MetadataFetcherService', () => {
  let service: MetadataFetcherService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MetadataFetcherServiceClass],
    }).compile();

    service = module.get<MetadataFetcherService>(MetadataFetcherServiceClass);
    jest.clearAllMocks();
  });

  // private-range classification (loopback, RFC1918, link-local, IPv6,
  // mapped, boundaries) is owned by private-host.spec.ts; these cases only
  // pin that fetchMetadata routes through that guard
  describe('SSRF protection – wiring to the private-host guard', () => {
    it('blocks a private host: empty metadata, fetch never called', async () => {
      mockFetchReject();
      const result = await service.fetchMetadata('http://169.254.169.254/');
      expect(global.fetch).not.toHaveBeenCalled();
      expect(result).toEqual({
        description: null,
        faviconUrl: null,
        imageUrl: null,
        siteName: null,
        source: null,
        title: null,
      });
    });

    it('blocks an invalid URL that cannot be parsed', async () => {
      mockFetchReject();
      const result = await service.fetchMetadata('not-a-url');
      expect(global.fetch).not.toHaveBeenCalled();
      expect(result.title).toBeNull();
    });
  });

  // boundary + range classification is owned by private-host.spec.ts; this
  // only pins that an allowed host passes the guard through to fetch. A
  // public IP literal keeps the guard off DNS (that path is in safe-fetch)
  describe('SSRF protection – allowed hosts', () => {
    it('allows a public host and calls fetch', async () => {
      mockFetchSuccess();
      await service.fetchMetadata('https://93.184.216.34/');
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  // redirect-to-private blocking is owned by safe-fetch.spec.ts; this single
  // case pins that fetchMetadata's redirect handling routes through it
  describe('SSRF protection – redirect bypass', () => {
    it('does not follow a redirect to a private host', async () => {
      // public host 302s to an internal address; safeFetch re-validates the
      // redirect hop and refuses
      global.fetch = jest.fn().mockResolvedValue({
        status: 302,
        ok: false,
        headers: {
          get: (key: string) =>
            key.toLowerCase() === 'location' ? 'http://169.254.169.254/' : null,
        },
        body: null,
      }) as unknown as typeof fetch;

      const result = await service.fetchMetadata('https://93.184.216.34/redir');

      // only the first hop was fetched; the private redirect was blocked
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(result.title).toBeNull();
      expect(result.description).toBeNull();
    });
  });

  describe('fetchMetadata – favicon fallback', () => {
    it('adds /favicon.ico fallback when no favicon found in HTML', async () => {
      mockFetchHtml(
        '<html><head><title>No icon</title></head><body></body></html>',
      );

      const result = await service.fetchMetadata('https://93.184.216.34/page');
      expect(result.faviconUrl).toBe('https://93.184.216.34/favicon.ico');
    });
  });

  // the page author controls these attributes, so the scheme is untrusted
  // input; render-time gating stays, this keeps the junk out of the column
  describe('fetchMetadata – URL scheme allowlist', () => {
    it.each([
      ['javascript:', 'javascript:alert(1)'],
      ['data:', 'data:image/svg+xml,<svg/>'],
      ['file:', 'file:///etc/passwd'],
      ['vbscript:', 'vbscript:msgbox(1)'],
    ])(
      'refuses a %s favicon and falls back to /favicon.ico',
      async (_scheme, href) => {
        mockFetchHtml(
          `<html><head><title>t</title><link rel="icon" href="${href}"></head><body></body></html>`,
        );

        const result = await service.fetchMetadata(
          'https://93.184.216.34/page',
        );
        expect(result.faviconUrl).toBe('https://93.184.216.34/favicon.ico');
      },
    );

    it('refuses a non-http(s) og:image and stores null', async () => {
      mockFetchHtml(
        '<html><head><title>t</title><meta property="og:image" content="javascript:alert(1)"></head><body></body></html>',
      );

      const result = await service.fetchMetadata('https://93.184.216.34/page');
      expect(result.imageUrl).toBeNull();
    });

    it('still resolves a relative favicon against the page URL', async () => {
      mockFetchHtml(
        '<html><head><title>t</title><link rel="icon" href="/icons/site.png"></head><body></body></html>',
      );

      const result = await service.fetchMetadata('https://93.184.216.34/page');
      expect(result.faviconUrl).toBe('https://93.184.216.34/icons/site.png');
    });

    it('still passes an absolute https image through', async () => {
      mockFetchHtml(
        '<html><head><title>t</title><meta property="og:image" content="https://cdn.example.com/hero.png"></head><body></body></html>',
      );

      const result = await service.fetchMetadata('https://93.184.216.34/page');
      expect(result.imageUrl).toBe('https://cdn.example.com/hero.png');
    });
  });
});
