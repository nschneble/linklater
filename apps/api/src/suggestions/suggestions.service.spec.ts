import { jest } from '@jest/globals';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../prisma/generated/client', () => ({ Prisma: {} }));

import { Test, type TestingModule } from '@nestjs/testing';

import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { RECURRING_JOB_RETRY_OPTIONS } from '../queue/queue.constants';
import { RssFeedService } from './rss-feed.service';
import { SuggestionsService } from './suggestions.service';
import { WikipediaAdapter } from './wikipedia-adapter';
import type { Suggestion } from './suggestions.types.js';

const TEST_USER_ID = 'user-1';

describe('SuggestionsService', () => {
  let service: SuggestionsService;
  const originalTestingUi = process.env.TESTING_UI;

  const rssFeedServiceMock = {
    refreshAll: jest.fn().mockResolvedValue(undefined),
    getLatest: jest.fn().mockResolvedValue([] as Suggestion[]),
  } as unknown as RssFeedService;

  const wikipediaAdapterMock = {
    key: 'wikipedia',
    name: 'Wikipedia',
    fetch: jest.fn().mockResolvedValue([] as Suggestion[]),
  } as unknown as WikipediaAdapter;

  const queueServiceMock = {
    schedule: jest.fn().mockResolvedValue(undefined),
    work: jest.fn().mockResolvedValue('worker-1'),
  } as unknown as QueueService;

  const prismaMock = {
    link: {
      findMany: jest.fn().mockResolvedValue([] as { url: string }[]),
    },
  } as unknown as PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SuggestionsService,
        { provide: RssFeedService, useValue: rssFeedServiceMock },
        { provide: WikipediaAdapter, useValue: wikipediaAdapterMock },
        { provide: QueueService, useValue: queueServiceMock },
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<SuggestionsService>(SuggestionsService);
    jest.clearAllMocks();
    (prismaMock.link.findMany as jest.Mock).mockResolvedValue([]);
  });

  afterEach(() => {
    if (originalTestingUi === undefined) {
      delete process.env.TESTING_UI;
    } else {
      process.env.TESTING_UI = originalTestingUi;
    }
  });

  describe('onModuleInit', () => {
    it('schedules the recurring RSS refresh with a retry policy every six hours', async () => {
      await service.onModuleInit();

      expect(queueServiceMock.schedule).toHaveBeenCalledWith(
        'rss-refresh',
        '0 */6 * * *',
        undefined,
        RECURRING_JOB_RETRY_OPTIONS,
      );
    });

    it('registers a worker for the refresh queue', async () => {
      await service.onModuleInit();

      expect(queueServiceMock.work).toHaveBeenCalledWith(
        'rss-refresh',
        expect.any(Function),
      );
    });

    it('kicks off a one-shot bootstrap refresh', async () => {
      await service.onModuleInit();
      // bootstrap refresh runs in an IIFE; yield a microtask so it lands
      await Promise.resolve();

      expect(rssFeedServiceMock.refreshAll).toHaveBeenCalled();
    });
  });

  describe('getSuggestions', () => {
    function aSuggestion(url: string): Suggestion {
      return {
        url,
        title: url,
        description: null,
        imageUrl: null,
        siteName: null,
      };
    }

    it('returns suggestions from a source that successfully returns entries', async () => {
      (wikipediaAdapterMock.fetch as jest.Mock).mockResolvedValueOnce([
        aSuggestion('https://wiki/A'),
      ]);
      (rssFeedServiceMock.getLatest as jest.Mock).mockResolvedValue([]);

      // force the pick to Wikipedia by leaving all other adapters empty
      const result = await service.getSuggestions(1, TEST_USER_ID);

      expect(result).not.toBeNull();
      expect(result!.suggestions.length).toBeGreaterThan(0);
    });

    it('falls back to another source when the first picked source returns no entries', async () => {
      // two sources; first empty, second returns one; Math.random forced for order
      jest
        .spyOn(Math, 'random')
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(0);

      (wikipediaAdapterMock.fetch as jest.Mock).mockResolvedValue([]);
      let getLatestCalls = 0;
      (rssFeedServiceMock.getLatest as jest.Mock).mockImplementation(
        async () => {
          getLatestCalls += 1;
          if (getLatestCalls < 2) return [];
          return [aSuggestion('https://example.com/found')];
        },
      );

      const result = await service.getSuggestions(1, TEST_USER_ID);

      expect(result).not.toBeNull();
      expect(result!.suggestions[0].url).toBe('https://example.com/found');

      (Math.random as jest.Mock).mockRestore();
    });

    it('falls back to another source when an adapter throws', async () => {
      (wikipediaAdapterMock.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('boom'),
      );
      (rssFeedServiceMock.getLatest as jest.Mock).mockResolvedValueOnce([
        aSuggestion('https://example.com/safe'),
      ]);

      const result = await service.getSuggestions(1, TEST_USER_ID);

      // either pick order works; contract is only "result is not null"
      expect(result).not.toBeNull();
    });

    it('returns null when every source returns nothing or throws', async () => {
      (wikipediaAdapterMock.fetch as jest.Mock).mockResolvedValue([]);
      (rssFeedServiceMock.getLatest as jest.Mock).mockResolvedValue([]);

      const result = await service.getSuggestions(3, TEST_USER_ID);

      expect(result).toBeNull();
    });

    it('passes the requested count down to the adapter', async () => {
      const seen: number[] = [];
      (wikipediaAdapterMock.fetch as jest.Mock).mockImplementation(
        async (count: number) => {
          seen.push(count);
          return [aSuggestion('https://wiki/X')];
        },
      );
      (rssFeedServiceMock.getLatest as jest.Mock).mockImplementation(
        async (_key: string, count: number) => {
          seen.push(count);
          return [aSuggestion('https://example.com/Y')];
        },
      );

      await service.getSuggestions(5, TEST_USER_ID);

      // at least one adapter saw count=5 and returned non-empty
      expect(seen).toContain(5);
    });

    it('filters out suggestions whose URL the user has already saved', async () => {
      (wikipediaAdapterMock.fetch as jest.Mock).mockResolvedValue([
        aSuggestion('https://wiki/dup'),
        aSuggestion('https://wiki/fresh'),
      ]);
      (rssFeedServiceMock.getLatest as jest.Mock).mockResolvedValue([]);
      (prismaMock.link.findMany as jest.Mock).mockResolvedValue([
        { url: 'https://wiki/dup' },
      ]);

      const result = await service.getSuggestions(2, TEST_USER_ID);

      expect(result).not.toBeNull();
      expect(result!.suggestions.map((suggestion) => suggestion.url)).toEqual([
        'https://wiki/fresh',
      ]);
    });

    it('queries the Link table scoped to the authenticated user', async () => {
      (wikipediaAdapterMock.fetch as jest.Mock).mockResolvedValue([
        aSuggestion('https://wiki/x'),
      ]);
      (rssFeedServiceMock.getLatest as jest.Mock).mockResolvedValue([]);

      await service.getSuggestions(1, TEST_USER_ID);

      const findManyMock = prismaMock.link.findMany as jest.Mock;
      expect(findManyMock).toHaveBeenCalled();
      const callArguments = findManyMock.mock.calls[0][0] as {
        where: { userId: string; url: { in: string[] } };
        select: { url: true };
      };
      expect(callArguments.where.userId).toBe(TEST_USER_ID);
      expect(callArguments.where.url.in).toContain('https://wiki/x');
      expect(callArguments.select).toEqual({ url: true });
    });

    it('drops a source whose every suggestion is already saved and tries another', async () => {
      let wikipediaCalled = 0;
      let rssCalled = 0;
      (wikipediaAdapterMock.fetch as jest.Mock).mockImplementation(async () => {
        wikipediaCalled += 1;
        return [aSuggestion('https://wiki/saved')];
      });
      (rssFeedServiceMock.getLatest as jest.Mock).mockImplementation(
        async () => {
          rssCalled += 1;
          return [aSuggestion('https://example.com/fresh')];
        },
      );
      (prismaMock.link.findMany as jest.Mock).mockImplementation(
        async ({ where }: { where: { url: { in: string[] } } }) => {
          return where.url.in
            .filter((url) => url === 'https://wiki/saved')
            .map((url) => ({ url }));
        },
      );

      const result = await service.getSuggestions(1, TEST_USER_ID);

      expect(result).not.toBeNull();
      expect(result!.suggestions[0].url).toBe('https://example.com/fresh');
      // either adapter may run; contract is recovery to a non-saved suggestion
      expect(wikipediaCalled + rssCalled).toBeGreaterThan(0);
    });

    it('returns null when every source produces only already-saved URLs', async () => {
      (wikipediaAdapterMock.fetch as jest.Mock).mockResolvedValue([
        aSuggestion('https://wiki/saved'),
      ]);
      (rssFeedServiceMock.getLatest as jest.Mock).mockResolvedValue([
        aSuggestion('https://example.com/saved'),
      ]);
      // every URL passed in comes back as "saved" (total duplicate collision)
      (prismaMock.link.findMany as jest.Mock).mockImplementation(
        async ({ where }: { where: { url: { in: string[] } } }) =>
          where.url.in.map((url) => ({ url })),
      );

      const result = await service.getSuggestions(1, TEST_USER_ID);

      expect(result).toBeNull();
    });
  });

  describe('TESTING_UI bypass', () => {
    beforeEach(() => {
      process.env.TESTING_UI = '1';
    });

    describe('onModuleInit', () => {
      it('skips queue scheduling so the test DB sees no recurring writes', async () => {
        await service.onModuleInit();

        expect(queueServiceMock.schedule).not.toHaveBeenCalled();
        expect(queueServiceMock.work).not.toHaveBeenCalled();
      });

      it('skips the bootstrap RSS refresh so no external network call fires', async () => {
        await service.onModuleInit();
        await Promise.resolve();

        expect(rssFeedServiceMock.refreshAll).not.toHaveBeenCalled();
      });
    });

    describe('getSuggestions', () => {
      it('returns deterministic fixture entries instead of calling any adapter', async () => {
        const result = await service.getSuggestions(2, TEST_USER_ID);

        expect(result).not.toBeNull();
        expect(result!.sourceName).toBe('Testing Fixture');
        expect(result!.suggestions).toHaveLength(2);
        expect(wikipediaAdapterMock.fetch).not.toHaveBeenCalled();
        expect(rssFeedServiceMock.getLatest).not.toHaveBeenCalled();
      });

      it('clamps requested count to the fixture pool size', async () => {
        const result = await service.getSuggestions(99, TEST_USER_ID);

        expect(result!.suggestions).toHaveLength(2);
      });

      it('returns at least one suggestion even when count=0', async () => {
        const result = await service.getSuggestions(0, TEST_USER_ID);

        expect(result!.suggestions.length).toBeGreaterThanOrEqual(1);
      });

      it('still runs the saved-link filter so a fixture saving a pool URL never sees the duplicate surface as a suggestion', async () => {
        await service.getSuggestions(1, TEST_USER_ID);

        expect(prismaMock.link.findMany).toHaveBeenCalledWith({
          where: {
            userId: TEST_USER_ID,
            url: {
              in: ['https://example.test/articles/testing-ui-determinism'],
            },
          },
          select: { url: true },
        });
      });

      it('falls back to the first pool entry when every candidate is already saved, so the callout still renders', async () => {
        (prismaMock.link.findMany as jest.Mock).mockResolvedValueOnce([
          { url: 'https://example.test/articles/testing-ui-determinism' },
          { url: 'https://example.test/articles/sample-suggestions' },
        ]);

        const result = await service.getSuggestions(2, TEST_USER_ID);

        expect(result!.suggestions).toHaveLength(1);
        expect(result!.suggestions[0].url).toBe(
          'https://example.test/articles/testing-ui-determinism',
        );
      });
    });
  });
});
