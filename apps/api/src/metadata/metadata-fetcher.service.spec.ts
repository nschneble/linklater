import { jest } from '@jest/globals';

import { Test, TestingModule } from '@nestjs/testing';
import { MetadataFetcherService } from './metadata-fetcher.service';

/**
 * Builds a minimal fetch mock that returns a valid HTML response. Used to
 * confirm a URL passes the SSRF guard (i.e. a fetch mock being called means
 * the guard allowed the request through).
 */
const mockFetchSuccess = () => {
  const html = '<html><head><title>Test</title></head><body></body></html>';
  const encoder = new TextEncoder();
  const bytes = encoder.encode(html);
  global.fetch = jest.fn().mockResolvedValue({
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

const mockFetchReject = () => {
  // Never resolves — the SSRF guard should prevent fetch from being called
  // at all. Using a never-settling mock avoids unhandled-rejection noise
  // while still allowing the test to assert fetch was not invoked.
  global.fetch = jest
    .fn()
    .mockReturnValue(new Promise(() => {})) as unknown as typeof fetch;
};

describe('MetadataFetcherService', () => {
  let service: MetadataFetcherService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MetadataFetcherService],
    }).compile();

    service = module.get<MetadataFetcherService>(MetadataFetcherService);
    jest.clearAllMocks();
  });

  describe('SSRF protection — blocked hosts (isPrivateHost)', () => {
    const blockedUrls = [
      // Localhost
      ['localhost', 'http://localhost/path'],
      ['localhost with port', 'http://localhost:8080/'],
      // IPv4 loopback
      ['127.0.0.1', 'http://127.0.0.1/'],
      ['127.0.0.2 (loopback range)', 'http://127.0.0.2/'],
      ['127.255.255.255 (loopback range end)', 'http://127.255.255.255/'],
      // RFC 1918 — 10.0.0.0/8
      ['10.0.0.1', 'http://10.0.0.1/'],
      ['10.255.255.255', 'http://10.255.255.255/'],
      // RFC 1918 — 172.16.0.0/12
      ['172.16.0.1', 'http://172.16.0.1/'],
      ['172.31.255.255', 'http://172.31.255.255/'],
      // RFC 1918 — 192.168.0.0/16
      ['192.168.0.1', 'http://192.168.0.1/'],
      ['192.168.255.255', 'http://192.168.255.255/'],
      // Link-local — 169.254.0.0/16
      ['169.254.0.1 (link-local)', 'http://169.254.0.1/'],
      ['169.254.169.254 (AWS metadata)', 'http://169.254.169.254/'],
      // IPv6 loopback
      ['::1', 'http://[::1]/'],
      // IPv6 unique-local (fc00::/7)
      ['fc00::1 (unique-local)', 'http://[fc00::1]/'],
      ['fd00::1 (unique-local)', 'http://[fd00::1]/'],
      // IPv6 link-local (fe80::/10)
      ['fe80::1 (link-local)', 'http://[fe80::1]/'],
      // IPv4-mapped IPv6 — must re-check the embedded IPv4 address
      ['::ffff:127.0.0.1 (mapped loopback)', 'http://[::ffff:127.0.0.1]/'],
      ['::ffff:192.168.1.1 (mapped private)', 'http://[::ffff:192.168.1.1]/'],
      ['::ffff:10.0.0.1 (mapped private)', 'http://[::ffff:10.0.0.1]/'],
      [
        '::ffff:169.254.169.254 (mapped AWS metadata)',
        'http://[::ffff:169.254.169.254]/',
      ],
    ] as const;

    it.each(blockedUrls)('blocks %s', async (_label: string, url: string) => {
      mockFetchReject();
      const result = await service.fetchMetadata(url);
      // Should return empty metadata without ever calling fetch
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

  describe('SSRF protection — allowed hosts', () => {
    const allowedUrls = [
      ['public IPv4', 'https://93.184.216.34/'],
      ['172.15.x.x (just outside private range)', 'https://172.15.0.1/'],
      ['172.32.x.x (just outside private range)', 'https://172.32.0.1/'],
      ['public domain', 'https://example.com/'],
    ] as const;

    it.each(allowedUrls)(
      'allows %s and calls fetch',
      async (_label: string, url: string) => {
        mockFetchSuccess();
        await service.fetchMetadata(url);
        expect(global.fetch).toHaveBeenCalledTimes(1);
      },
    );
  });

  describe('fetchMetadata — behavior on blocked host', () => {
    it('returns empty metadata without throwing', async () => {
      mockFetchReject();
      const result = await service.fetchMetadata('http://192.168.1.1/page');
      expect(result).toEqual({
        description: null,
        faviconUrl: null,
        imageUrl: null,
        siteName: null,
        source: null,
        title: null,
      });
    });
  });

  describe('fetchMetadata — favicon fallback', () => {
    it('adds /favicon.ico fallback when no favicon found in HTML', async () => {
      const html =
        '<html><head><title>No icon</title></head><body></body></html>';
      const encoder = new TextEncoder();
      const bytes = encoder.encode(html);
      global.fetch = jest.fn().mockResolvedValue({
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

      const result = await service.fetchMetadata('https://example.com/page');
      expect(result.faviconUrl).toBe('https://example.com/favicon.ico');
    });
  });
});
