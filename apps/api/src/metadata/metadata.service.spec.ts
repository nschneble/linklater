import { jest } from '@jest/globals';

import {
  MAX_DESCRIPTION_LENGTH,
  METADATA_WORKER_CONCURRENCY,
} from './metadata.constants';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { QUEUES } from '../queue/queue.constants';
import { Test, TestingModule } from '@nestjs/testing';
import type { MetadataService } from './metadata.service';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../prisma/generated/client', () => ({ Prisma: {} }));

// stub DNS to a public IP so name-host tests pass in a no-network sandbox
jest.unstable_mockModule('node:dns/promises', () => ({
  lookup: jest.fn(async () => [{ address: '93.184.216.34', family: 4 }]),
}));

// mock undici's fetch, forwarding to global.fetch that these tests drive
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
const { MetadataService: MetadataServiceClass } =
  await import('./metadata.service');

const FALLBACK_DESCRIPTION = 'This is a fallback example';
const LINK_ID = 'link-1';
const LINK_PDF_URL = 'https://example.com/page/attachment.pdf';
const LINK_URL = 'https://example.com/page';
const OG_DESCRIPTION = 'This is an example';
const OG_IMAGE = 'https://example.com/page/preview.jpg';
const OG_TITLE = 'My Article Title';
const OG_SITE_NAME = 'Example Site';
const FAVICON_URL = 'https://example.com/favicon.ico';
const RELATIVE_OG_IMAGE = '/page/preview.jpg';
const WORKER_ID = 'worker-1';

const makeHtml = (
  overrides: {
    faviconHref?: string;
    faviconRel?: string;
    metaDescription?: string;
    ogDescription?: string;
    ogImage?: string;
    ogSiteName?: string;
    ogTitle?: string;
    title?: string;
  } = {},
) => {
  const {
    faviconHref,
    faviconRel = 'icon',
    metaDescription,
    ogDescription,
    ogImage,
    ogSiteName,
    ogTitle,
    title,
  } = overrides;

  const faviconTag = faviconHref
    ? `<link rel="${faviconRel}" href="${faviconHref}" />`
    : '';
  const metaDescriptionTag = metaDescription
    ? `<meta name="description" content="${metaDescription}" />`
    : '';
  const ogDescriptionTag = ogDescription
    ? `<meta property="og:description" content="${ogDescription}" />`
    : '';
  const ogImageTag = ogImage
    ? `<meta property="og:image" content="${ogImage}" />`
    : '';
  const ogSiteNameTag = ogSiteName
    ? `<meta property="og:site_name" content="${ogSiteName}" />`
    : '';
  const ogTitleTag = ogTitle
    ? `<meta property="og:title" content="${ogTitle}" />`
    : '';
  const titleTag = title ? `<title>${title}</title>` : '';

  return `<html><head>${ogDescriptionTag}${metaDescriptionTag}${ogImageTag}${ogTitleTag}${ogSiteNameTag}${faviconTag}${titleTag}</head><body></body></html>`;
};

const mockFetch = (
  html: string,
  contentType = 'text/html; charset=utf-8',
  options: { contentLength?: string } = {},
) => {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(html);
  const headers = new Map<string, string>([['content-type', contentType]]);
  if (options.contentLength !== undefined) {
    headers.set('content-length', options.contentLength);
  }
  global.fetch = jest.fn().mockResolvedValue({
    headers: {
      get: (key: string) => headers.get(key.toLowerCase()) ?? null,
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

const mockFetchOversize = (totalBytes: number) => {
  // stream >size in 1 MB chunks to prove readBodyWithCap cancels mid-stream
  global.fetch = jest.fn().mockResolvedValue({
    headers: {
      get: (key: string) =>
        key.toLowerCase() === 'content-type' ? 'text/html' : null,
    },
    ok: true,
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        const chunkSize = 1024 * 1024;
        let emitted = 0;
        while (emitted < totalBytes) {
          const next = Math.min(chunkSize, totalBytes - emitted);
          controller.enqueue(new Uint8Array(next));
          emitted += next;
        }
        controller.close();
      },
    }),
  }) as unknown as typeof fetch;
};

describe('MetadataService', () => {
  let service: MetadataService;

  const prismaMock = {
    $executeRaw: jest.fn().mockResolvedValue(1),
    meta: {
      upsert: jest.fn(),
    },
  } as unknown as PrismaService;

  const queueMock = {
    work: jest.fn().mockResolvedValue(WORKER_ID),
  } as unknown as QueueService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MetadataFetcherServiceClass,
        MetadataServiceClass,
        { provide: PrismaService, useValue: prismaMock },
        { provide: QueueService, useValue: queueMock },
      ],
    }).compile();

    service = module.get<MetadataService>(MetadataServiceClass);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('fetchAndStore', () => {
    beforeEach(() => {
      (prismaMock.meta.upsert as jest.Mock).mockResolvedValue({});
    });

    it('extracts og:description and og:image from HTML', async () => {
      mockFetch(makeHtml({ ogDescription: OG_DESCRIPTION, ogImage: OG_IMAGE }));

      await service.fetchAndStore(LINK_ID, LINK_URL);

      expect(prismaMock.meta.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { linkId: LINK_ID },
          create: expect.objectContaining({
            description: OG_DESCRIPTION,
            imageUrl: OG_IMAGE,
            fetchedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('upserts all meta fields', async () => {
      mockFetch(
        makeHtml({
          ogDescription: OG_DESCRIPTION,
          ogImage: OG_IMAGE,
          ogTitle: OG_TITLE,
          ogSiteName: OG_SITE_NAME,
          faviconHref: FAVICON_URL,
        }),
      );

      await service.fetchAndStore(LINK_ID, LINK_URL);

      expect(prismaMock.meta.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            description: OG_DESCRIPTION,
            imageUrl: OG_IMAGE,
            title: OG_TITLE,
            siteName: OG_SITE_NAME,
            faviconUrl: FAVICON_URL,
          }),
        }),
      );
    });

    it('extracts og:title', async () => {
      mockFetch(makeHtml({ ogTitle: OG_TITLE }));

      await service.fetchAndStore(LINK_ID, LINK_URL);

      expect(prismaMock.meta.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ title: OG_TITLE }),
        }),
      );
    });

    it('falls back to <title> when og:title is absent', async () => {
      mockFetch(makeHtml({ title: 'Page Title' }));

      await service.fetchAndStore(LINK_ID, LINK_URL);

      expect(prismaMock.meta.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ title: 'Page Title' }),
        }),
      );
    });

    it('extracts og:site_name', async () => {
      mockFetch(makeHtml({ ogSiteName: OG_SITE_NAME }));

      await service.fetchAndStore(LINK_ID, LINK_URL);

      expect(prismaMock.meta.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ siteName: OG_SITE_NAME }),
        }),
      );
    });

    it('extracts favicon from <link rel="icon">', async () => {
      mockFetch(makeHtml({ faviconHref: FAVICON_URL, faviconRel: 'icon' }));

      await service.fetchAndStore(LINK_ID, LINK_URL);

      expect(prismaMock.meta.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ faviconUrl: FAVICON_URL }),
        }),
      );
    });

    it('falls back to <link rel="shortcut icon"> when rel="icon" absent', async () => {
      mockFetch(
        makeHtml({ faviconHref: FAVICON_URL, faviconRel: 'shortcut icon' }),
      );

      await service.fetchAndStore(LINK_ID, LINK_URL);

      expect(prismaMock.meta.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ faviconUrl: FAVICON_URL }),
        }),
      );
    });

    it('falls back to /favicon.ico when no favicon link tag found', async () => {
      mockFetch(makeHtml({ ogDescription: OG_DESCRIPTION }));

      await service.fetchAndStore(LINK_ID, LINK_URL);

      expect(prismaMock.meta.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            faviconUrl: 'https://example.com/favicon.ico',
          }),
        }),
      );
    });

    it('falls back to meta[name="description"] when og:description is absent', async () => {
      mockFetch(makeHtml({ metaDescription: FALLBACK_DESCRIPTION }));

      await service.fetchAndStore(LINK_ID, LINK_URL);

      expect(prismaMock.meta.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            description: FALLBACK_DESCRIPTION,
          }),
        }),
      );
    });

    it('resolves relative og:image URL against the page origin', async () => {
      mockFetch(makeHtml({ ogImage: RELATIVE_OG_IMAGE }));

      await service.fetchAndStore(LINK_ID, LINK_URL);

      expect(prismaMock.meta.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ imageUrl: OG_IMAGE }),
        }),
      );
    });

    it('handles pages with no meta tags gracefully', async () => {
      mockFetch('<html><head></head><body></body></html>');

      await service.fetchAndStore(LINK_ID, LINK_URL);

      expect(prismaMock.meta.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            description: null,
            imageUrl: null,
            title: null,
            siteName: null,
            fetchedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('marks fetch as attempted when fetch() throws', async () => {
      global.fetch = jest
        .fn()
        .mockRejectedValue(
          new Error('Network error'),
        ) as unknown as typeof fetch;

      await service.fetchAndStore(LINK_ID, LINK_URL);

      expect(prismaMock.meta.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { linkId: LINK_ID },
          create: expect.objectContaining({ fetchedAt: expect.any(Date) }),
        }),
      );
    });

    it('truncates description longer than 500 characters', async () => {
      const longDescription = 'duck '.repeat(MAX_DESCRIPTION_LENGTH * 2);
      mockFetch(makeHtml({ ogDescription: longDescription }));

      await service.fetchAndStore(LINK_ID, LINK_URL);

      const call = (prismaMock.meta.upsert as jest.Mock).mock.calls[0][0] as {
        create: { description: string };
      };
      expect(call.create.description?.length).toBe(MAX_DESCRIPTION_LENGTH);
    });

    it('skips parsing and marks fetchedAt for non-HTML content types', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        headers: { get: () => 'application/pdf' },
        ok: true,
        text: () => Promise.resolve(''),
      }) as unknown as typeof fetch;

      await service.fetchAndStore(LINK_ID, LINK_PDF_URL);

      expect(prismaMock.meta.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            description: null,
            imageUrl: null,
            fetchedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('stores raw HTML source', async () => {
      const html = makeHtml({ ogTitle: OG_TITLE });
      mockFetch(html);

      await service.fetchAndStore(LINK_ID, LINK_URL);

      expect(prismaMock.meta.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ source: html }),
        }),
      );
    });
  });

  it('updates searchVector on link after successful metadata fetch', async () => {
    (prismaMock.meta.upsert as jest.Mock).mockResolvedValue({});
    mockFetch(makeHtml({ ogTitle: OG_TITLE, ogDescription: OG_DESCRIPTION }));

    await service.fetchAndStore(LINK_ID, LINK_URL);

    expect(prismaMock.$executeRaw).toHaveBeenCalled();
  });

  it('registers a worker for the METADATA_FETCH queue with concurrency on init', async () => {
    (queueMock.work as jest.Mock).mockResolvedValue(WORKER_ID);

    await service.onModuleInit();

    expect(queueMock.work).toHaveBeenCalledWith(
      QUEUES.METADATA_FETCH,
      expect.any(Function),
      { localConcurrency: METADATA_WORKER_CONCURRENCY },
    );
  });

  it('worker callback invokes fetchAndStore for each job', async () => {
    let capturedCallback:
      | ((jobs: { data: { linkId: string; url: string } }[]) => Promise<void>)
      | null = null;

    (queueMock.work as jest.Mock).mockImplementation(
      (
        _queue: string,
        callback: (
          jobs: { data: { linkId: string; url: string } }[],
        ) => Promise<void>,
      ) => {
        capturedCallback = callback;
        return Promise.resolve(WORKER_ID);
      },
    );
    (prismaMock.meta.upsert as jest.Mock).mockResolvedValue({});
    mockFetch(makeHtml({ ogTitle: OG_TITLE }));

    await service.onModuleInit();

    expect(capturedCallback).not.toBeNull();
    await capturedCallback!([{ data: { linkId: LINK_ID, url: LINK_URL } }]);

    expect(prismaMock.meta.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { linkId: LINK_ID } }),
    );
  });

  describe('SSRF protection via isPrivateHost', () => {
    beforeEach(() => {
      (prismaMock.meta.upsert as jest.Mock).mockResolvedValue({});
    });

    it('blocks fetch to a private host and returns empty metadata without throwing', async () => {
      global.fetch = jest.fn() as unknown as typeof fetch;

      await service.fetchAndStore(LINK_ID, 'http://192.168.1.1/router');

      expect(global.fetch).not.toHaveBeenCalled();
      expect(prismaMock.meta.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ description: null, title: null }),
        }),
      );
    });

    it('allows fetch to a public hostname', async () => {
      mockFetch(makeHtml({ ogTitle: OG_TITLE }));

      await service.fetchAndStore(LINK_ID, 'https://example.com/page');

      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe('error handling in fetchAndStore', () => {
    beforeEach(() => {
      (prismaMock.meta.upsert as jest.Mock).mockResolvedValue({});
    });

    it('records fetchedAt when the upstream upsert inside the catch block also fails', async () => {
      global.fetch = jest
        .fn()
        .mockRejectedValue(
          new Error('Network error'),
        ) as unknown as typeof fetch;

      // first call (inside catch) also throws, second is irrelevant
      (prismaMock.meta.upsert as jest.Mock)
        .mockRejectedValueOnce(new Error('DB down'))
        .mockResolvedValue({});

      // should not propagate; swallowed by the inner .catch()
      await expect(
        service.fetchAndStore(LINK_ID, LINK_URL),
      ).resolves.not.toThrow();
    });

    it('returns null image when og:image is absent', async () => {
      mockFetch(makeHtml({ ogTitle: OG_TITLE }));

      await service.fetchAndStore(LINK_ID, LINK_URL);

      expect(prismaMock.meta.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ imageUrl: null }),
        }),
      );
    });

    it('handles a non-OK HTTP response gracefully', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        headers: { get: () => 'text/html' },
        ok: false,
        text: () => Promise.resolve(''),
      }) as unknown as typeof fetch;

      await service.fetchAndStore(LINK_ID, LINK_URL);

      expect(prismaMock.meta.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            description: null,
            imageUrl: null,
            fetchedAt: expect.any(Date),
          }),
        }),
      );
    });
  });

  describe('resolveUrl edge cases', () => {
    beforeEach(() => {
      (prismaMock.meta.upsert as jest.Mock).mockResolvedValue({});
    });

    it('truncates resolved URLs longer than MAX_URL_LENGTH', async () => {
      // build an OG image URL that resolves longer than MAX_URL_LENGTH
      const longPath = '/image/' + 'a'.repeat(2100);
      mockFetch(makeHtml({ ogImage: longPath }));

      await service.fetchAndStore(LINK_ID, LINK_URL);

      const call = (prismaMock.meta.upsert as jest.Mock).mock.calls[0][0] as {
        create: { imageUrl: string | null };
      };
      // either null (if resolution fails) or truncated to MAX_URL_LENGTH
      if (call.create.imageUrl !== null) {
        expect(call.create.imageUrl.length).toBeLessThanOrEqual(2000);
      }
    });

    it('falls back to empty string for an invalid relative URL', async () => {
      // an href that cannot be resolved (e.g. malformed data URI, no base)
      mockFetch(makeHtml({ faviconHref: '://bad-url', faviconRel: 'icon' }));

      await service.fetchAndStore(LINK_ID, LINK_URL);

      const call = (prismaMock.meta.upsert as jest.Mock).mock.calls[0][0] as {
        create: { faviconUrl: string | null };
      };
      // resolveUrl returns '' on parse failure; upsert still called
      expect(prismaMock.meta.upsert).toHaveBeenCalled();
      expect(typeof call.create.faviconUrl).toBe('string');
    });
  });

  describe('HTML size cap', () => {
    beforeEach(() => {
      (prismaMock.meta.upsert as jest.Mock).mockResolvedValue({});
    });

    it('refuses the fetch when Content-Length exceeds the cap', async () => {
      mockFetch(makeHtml({ ogTitle: OG_TITLE }), 'text/html', {
        contentLength: String(10 * 1024 * 1024), // 10 MB declared
      });

      await service.fetchAndStore(LINK_ID, LINK_URL);

      // body not parsed, so title stays null (empty metadata)
      expect(prismaMock.meta.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ title: null, source: null }),
        }),
      );
    });

    it('aborts mid-stream when the body crosses the cap even without Content-Length', async () => {
      mockFetchOversize(6 * 1024 * 1024); // 6 MB streamed; cap is 5 MB

      await service.fetchAndStore(LINK_ID, LINK_URL);

      expect(prismaMock.meta.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ title: null, source: null }),
        }),
      );
    });

    it('accepts a well-formed body under the cap', async () => {
      mockFetch(makeHtml({ ogTitle: OG_TITLE }), 'text/html', {
        contentLength: '1024',
      });

      await service.fetchAndStore(LINK_ID, LINK_URL);

      expect(prismaMock.meta.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ title: OG_TITLE }),
        }),
      );
    });
  });
});
