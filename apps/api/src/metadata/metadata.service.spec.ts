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
const RELATIVE_OG_IMAGE = '/page/preview.jpg';
const WORKER_ID = 'worker-1';

const makeHtml = (
  overrides: {
    metaDescription?: string;
    ogDescription?: string;
    ogImage?: string;
  } = {},
) => {
  const { metaDescription, ogDescription, ogImage } = overrides;

  const metaDescriptionTag = metaDescription
    ? `<meta name="description" content="${metaDescription}" />`
    : '';
  const ogDescriptionTag = ogDescription
    ? `<meta property="og:description" content="${ogDescription}" />`
    : '';
  const ogImageTag = ogImage
    ? `<meta property="og:image" content="${ogImage}" />`
    : '';

  return `<html><head>${ogDescriptionTag}${metaDescriptionTag}${ogImageTag}</head><body></body></html>`;
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
    link: {
      update: jest.fn(),
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

  it('extracts og:description and og:image from HTML', async () => {
    mockFetch(makeHtml({ ogDescription: OG_DESCRIPTION, ogImage: OG_IMAGE }));
    (prismaMock.link.update as jest.Mock).mockResolvedValue({});

    await service.fetchAndStore(LINK_ID, LINK_URL);

    expect(prismaMock.link.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: LINK_ID },
        data: expect.objectContaining({
          metaDescription: OG_DESCRIPTION,
          metaFetchedAt: expect.any(Date),
          metaImage: OG_IMAGE,
        }),
      }),
    );
  });

  it('falls back to meta[name="description"] when og:description is absent', async () => {
    mockFetch(makeHtml({ metaDescription: FALLBACK_DESCRIPTION }));
    (prismaMock.link.update as jest.Mock).mockResolvedValue({});

    await service.fetchAndStore(LINK_ID, LINK_URL);

    expect(prismaMock.link.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metaDescription: FALLBACK_DESCRIPTION,
        }),
      }),
    );
  });

  it('resolves relative og:image URL against the page origin', async () => {
    mockFetch(makeHtml({ ogImage: RELATIVE_OG_IMAGE }));
    (prismaMock.link.update as jest.Mock).mockResolvedValue({});

    await service.fetchAndStore(LINK_ID, LINK_URL);

    expect(prismaMock.link.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metaImage: OG_IMAGE,
        }),
      }),
    );
  });

  it('handles pages with no meta tags gracefully', async () => {
    mockFetch('<html><head></head><body></body></html>');
    (prismaMock.link.update as jest.Mock).mockResolvedValue({});

    await service.fetchAndStore(LINK_ID, LINK_URL);

    expect(prismaMock.link.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metaDescription: null,
          metaFetchedAt: expect.any(Date),
          metaImage: null,
        }),
      }),
    );
  });

  it('marks fetch as attempted when fetch() throws', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error('Network error')) as unknown as typeof fetch;
    (prismaMock.link.update as jest.Mock).mockResolvedValue({});

    await service.fetchAndStore(LINK_ID, LINK_URL);

    expect(prismaMock.link.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: LINK_ID },
        data: expect.objectContaining({ metaFetchedAt: expect.any(Date) }),
      }),
    );
  });

  it('truncates metaDescription longer than 500 characters', async () => {
    const longDescription = 'duck '.repeat(MAX_DESCRIPTION_LENGTH * 2);
    mockFetch(makeHtml({ ogDescription: longDescription }));
    (prismaMock.link.update as jest.Mock).mockResolvedValue({});

    await service.fetchAndStore(LINK_ID, LINK_URL);

    const call = (prismaMock.link.update as jest.Mock).mock.calls[0][0] as {
      data: { metaDescription: string };
    };
    expect(call.data.metaDescription?.length).toBe(MAX_DESCRIPTION_LENGTH);
  });

  it('skips parsing and marks metaFetchedAt for non-HTML content types', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      headers: { get: () => 'application/pdf' },
      ok: true,
      text: () => Promise.resolve(''),
    }) as unknown as typeof fetch;
    (prismaMock.link.update as jest.Mock).mockResolvedValue({});

    await service.fetchAndStore(LINK_ID, LINK_PDF_URL);

    expect(prismaMock.link.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metaDescription: null,
          metaFetchedAt: expect.any(Date),
          metaImage: null,
        }),
      }),
    );
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
