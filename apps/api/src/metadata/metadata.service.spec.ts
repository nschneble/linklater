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
    work: jest.fn().mockResolvedValue('88383E14-F80F-4F38-8473-119775738EF5'),
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
        ogDescription: 'JavaScript test coverage made simple.',
        ogImage: 'https://istanbul.js.org/assets/istanbul-logo.png',
      }),
    );
    (prismaMock.link.update as jest.Mock).mockResolvedValue({});

    await service.fetchAndStore(
      'F85A62B9-C7DD-4E9D-872B-C6322AC6AC72',
      'https://istanbul.js.org',
    );

    expect(prismaMock.link.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'F85A62B9-C7DD-4E9D-872B-C6322AC6AC72' },
        data: expect.objectContaining({
          metaDescription: 'JavaScript test coverage made simple.',
          metaImage: 'https://istanbul.js.org/assets/istanbul-logo.png',
          metaFetchedAt: expect.any(Date),
        }),
      }),
    );
  });

  it('falls back to meta[name="description"] when og:description is absent', async () => {
    mockFetch(makeHtml({ metaDescription: "I'm a fallback description!" }));
    (prismaMock.link.update as jest.Mock).mockResolvedValue({});

    await service.fetchAndStore(
      '67A1551B-2C1A-4476-8D17-D864436D4FF3',
      'https://istanbul.js.org',
    );

    expect(prismaMock.link.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metaDescription: "I'm a fallback description!",
        }),
      }),
    );
  });

  it('resolves relative og:image URL against the page origin', async () => {
    mockFetch(makeHtml({ ogImage: '/assets/istanbul-logo.png' }));
    (prismaMock.link.update as jest.Mock).mockResolvedValue({});

    await service.fetchAndStore(
      '7FC86F3E-1761-4033-8BA6-100C72138F48',
      'https://istanbul.js.org',
    );

    expect(prismaMock.link.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metaImage: 'https://istanbul.js.org/assets/istanbul-logo.png',
        }),
      }),
    );
  });

  it('handles pages with no meta tags gracefully', async () => {
    mockFetch('<html><head></head><body></body></html>');
    (prismaMock.link.update as jest.Mock).mockResolvedValue({});

    await service.fetchAndStore(
      '22DD1FE4-2AED-4402-829C-6321683E7A49',
      'https://constantinople.js.org',
    );

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

    await service.fetchAndStore(
      '84052E1F-8067-449A-B9C2-2732D2AE6D7C',
      'https://istanbul.js.org',
    );

    expect(prismaMock.link.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: '84052E1F-8067-449A-B9C2-2732D2AE6D7C' },
        data: expect.objectContaining({ metaFetchedAt: expect.any(Date) }),
      }),
    );
  });

  it('truncates metaDescription longer than 500 chars', async () => {
    const longDescription = 'x'.repeat(600);
    mockFetch(makeHtml({ ogDescription: longDescription }));
    (prismaMock.link.update as jest.Mock).mockResolvedValue({});

    await service.fetchAndStore(
      'A6C5A089-4EBC-4427-9872-F79A77389F24',
      'https://istanbul.js.org',
    );

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

    await service.fetchAndStore(
      '067104FD-4DB8-498F-9B20-07D3F0A01E5A',
      'https://smallpdf.com/handle-widget#url=https://assets.ctfassets.net/l3l0sjr15nav/29D2yYGKlHNm0fB2YM1uW4/8e638080a0603252b1a50f35ae8762fd/Get_Started_With_Smallpdf.pdf',
    );

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
    (queueMock.work as jest.Mock).mockResolvedValue(
      '6535E04E-580C-4C79-8D24-CE5A58DC7CAC',
    );

    await service.onModuleInit();

    expect(queueMock.work).toHaveBeenCalledWith(
      QUEUES.METADATA_FETCH,
      expect.any(Function),
    );
  });
});
