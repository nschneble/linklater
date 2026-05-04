import { jest } from '@jest/globals';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../prisma/generated/client', () => ({ Prisma: {} }));

import { MAX_DESCRIPTION_LENGTH } from './metadata.constants';
import { MetadataService } from './metadata.service';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { QUEUES } from '../queue/queue.constants';
import { Test, TestingModule } from '@nestjs/testing';

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

const mockFetch = (html: string, contentType = 'text/html; charset=utf-8') => {
  global.fetch = jest.fn().mockResolvedValue({
    headers: { get: () => contentType },
    ok: true,
    text: () => Promise.resolve(html),
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
        MetadataService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: QueueService, useValue: queueMock },
      ],
    }).compile();

    service = module.get<MetadataService>(MetadataService);
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

  it('registers a worker for the METADATA_FETCH queue on init', async () => {
    (queueMock.work as jest.Mock).mockResolvedValue(WORKER_ID);

    await service.onModuleInit();

    expect(queueMock.work).toHaveBeenCalledWith(
      QUEUES.METADATA_FETCH,
      expect.any(Function),
    );
  });
});
