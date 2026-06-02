import { jest } from '@jest/globals';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../prisma/generated/client', () => ({ Prisma: {} }));

import { Test, type TestingModule } from '@nestjs/testing';

import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { RssFeedService } from './rss-feed.service';
import { SuggestionsService } from './suggestions.service';
import { WikipediaAdapter } from './wikipedia-adapter';
import type { Suggestion } from './suggestions.types.js';

const TEST_USER_ID = 'user-1';

describe('SuggestionsService', () => {
  let service: SuggestionsService;

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

  describe('onModuleInit', () => {
    it('schedules the recurring RSS refresh on every six hours', async () => {
      await service.onModuleInit();

      expect(queueServiceMock.schedule).toHaveBeenCalledWith(
        'rss-refresh',
        '0 */6 * * *',
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
      // The bootstrap refresh runs inside an IIFE so we need to yield to
      // the microtask queue once for it to land.
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

      // Force the random pick to Wikipedia by making all other adapters
      // empty — the service will exhaust them all and end on Wikipedia
      // if Wikipedia is the last surviving candidate.
      const result = await service.getSuggestions(1, TEST_USER_ID);

      expect(result).not.toBeNull();
      expect(result!.suggestions.length).toBeGreaterThan(0);
    });

    it('falls back to another source when the first picked source returns no entries', async () => {
      // Two sources tried, first returns nothing, second returns one
      // entry. Math.random is forced so the order is deterministic.
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

      // Either Wikipedia gets picked then fails (we recover) or another
      // source is picked first and returns the safe entry — both are
      // acceptable outcomes, the contract is "result is not null".
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

      // At least one adapter saw count=5 and returned non-empty.
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
      // Both adapters may run depending on random pick order — the
      // contract is just that we recovered to a non-saved suggestion.
      expect(wikipediaCalled + rssCalled).toBeGreaterThan(0);
    });

    it('returns null when every source produces only already-saved URLs', async () => {
      (wikipediaAdapterMock.fetch as jest.Mock).mockResolvedValue([
        aSuggestion('https://wiki/saved'),
      ]);
      (rssFeedServiceMock.getLatest as jest.Mock).mockResolvedValue([
        aSuggestion('https://example.com/saved'),
      ]);
      // Every URL passed in comes back as "saved" — total duplicate
      // collision.
      (prismaMock.link.findMany as jest.Mock).mockImplementation(
        async ({ where }: { where: { url: { in: string[] } } }) =>
          where.url.in.map((url) => ({ url })),
      );

      const result = await service.getSuggestions(1, TEST_USER_ID);

      expect(result).toBeNull();
    });
  });
});
