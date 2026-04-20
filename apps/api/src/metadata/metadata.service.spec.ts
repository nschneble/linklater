import { jest } from '@jest/globals';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../prisma/generated/client', () => ({ Prisma: {} }));

import { Test, TestingModule } from '@nestjs/testing';
import { MetadataService } from './metadata.service';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { QUEUES } from '../queue/queue.constants';

const makeHtml = (
  overrides: {
    ogDescription?: string;
    metaDescription?: string;
    ogImage?: string;
  } = {},
) => {
  const { ogDescription, metaDescription, ogImage } = overrides;

  const ogDescriptionTag = ogDescription
    ? `<meta property="og:description" content="${ogDescription}" />`
    : '';
  const metaDescriptionTag = metaDescription
    ? `<meta name="description" content="${metaDescription}" />`
    : '';
  const ogImageTag = ogImage
    ? `<meta property="og:image" content="${ogImage}" />`
    : '';

  return `<html><head>${ogDescriptionTag}${metaDescriptionTag}${ogImageTag}</head><body></body></html>`;
};

const mockFetch = (html: string, contentType = 'text/html; charset=utf-8') => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    headers: { get: () => contentType },
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
    work: jest.fn().mockResolvedValue('worker-id'),
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
    mockFetch(
      makeHtml({
        ogDescription: 'A great page',
        ogImage: 'https://example.com/img.jpg',
      }),
    );
    (prismaMock.link.update as jest.Mock).mockResolvedValue({});

    await service.fetchAndStore('link1', 'https://example.com');

    expect(prismaMock.link.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'link1' },
        data: expect.objectContaining({
          metaDescription: 'A great page',
          metaImage: 'https://example.com/img.jpg',
          metaFetchedAt: expect.any(Date),
        }),
      }),
    );
  });

  it('falls back to meta[name="description"] when og:description is absent', async () => {
    mockFetch(makeHtml({ metaDescription: 'Fallback description' }));
    (prismaMock.link.update as jest.Mock).mockResolvedValue({});

    await service.fetchAndStore('link1', 'https://example.com');

    expect(prismaMock.link.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metaDescription: 'Fallback description',
        }),
      }),
    );
  });

  it('resolves relative og:image URL against the page origin', async () => {
    mockFetch(makeHtml({ ogImage: '/images/preview.jpg' }));
    (prismaMock.link.update as jest.Mock).mockResolvedValue({});

    await service.fetchAndStore('link1', 'https://example.com/some/page');

    expect(prismaMock.link.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metaImage: 'https://example.com/images/preview.jpg',
        }),
      }),
    );
  });

  it('handles pages with no meta tags gracefully', async () => {
    mockFetch('<html><head></head><body></body></html>');
    (prismaMock.link.update as jest.Mock).mockResolvedValue({});

    await service.fetchAndStore('link1', 'https://example.com');

    expect(prismaMock.link.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metaDescription: null,
          metaImage: null,
          metaFetchedAt: expect.any(Date),
        }),
      }),
    );
  });

  it('marks fetch as attempted when fetch() throws', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error('Network error')) as unknown as typeof fetch;
    (prismaMock.link.update as jest.Mock).mockResolvedValue({});

    await service.fetchAndStore('link1', 'https://example.com');

    expect(prismaMock.link.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'link1' },
        data: expect.objectContaining({ metaFetchedAt: expect.any(Date) }),
      }),
    );
  });

  it('truncates metaDescription longer than 500 chars', async () => {
    const longDescription = 'x'.repeat(600);
    mockFetch(makeHtml({ ogDescription: longDescription }));
    (prismaMock.link.update as jest.Mock).mockResolvedValue({});

    await service.fetchAndStore('link1', 'https://example.com');

    const call = (prismaMock.link.update as jest.Mock).mock.calls[0][0] as {
      data: { metaDescription: string };
    };
    expect(call.data.metaDescription?.length).toBe(500);
  });

  it('skips parsing and marks metaFetchedAt for non-HTML content types', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/pdf' },
      text: () => Promise.resolve(''),
    }) as unknown as typeof fetch;
    (prismaMock.link.update as jest.Mock).mockResolvedValue({});

    await service.fetchAndStore('link1', 'https://example.com/file.pdf');

    expect(prismaMock.link.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metaDescription: null,
          metaImage: null,
          metaFetchedAt: expect.any(Date),
        }),
      }),
    );
  });

  it('registers a worker for the METADATA_FETCH queue on init', async () => {
    (queueMock.work as jest.Mock).mockResolvedValue('worker-id');

    await service.onModuleInit();

    expect(queueMock.work).toHaveBeenCalledWith(
      QUEUES.METADATA_FETCH,
      expect.any(Function),
    );
  });
});
