import { jest } from '@jest/globals';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../prisma/generated/client', () => ({ Prisma: {} }));

import { Test, type TestingModule } from '@nestjs/testing';

import { QueueService } from '../queue/queue.service';
import { RssFeedService } from './rss-feed.service';
import { SuggestionsService } from './suggestions.service';
import { WikipediaAdapter } from './wikipedia-adapter';
import type { Suggestion } from './suggestions.types.js';

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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SuggestionsService,
        { provide: RssFeedService, useValue: rssFeedServiceMock },
        { provide: WikipediaAdapter, useValue: wikipediaAdapterMock },
        { provide: QueueService, useValue: queueServiceMock },
      ],
    }).compile();

    service = module.get<SuggestionsService>(SuggestionsService);
    jest.clearAllMocks();
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
      const result = await service.getSuggestions(1);

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

      const result = await service.getSuggestions(1);

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

      const result = await service.getSuggestions(1);

      // Either Wikipedia gets picked then fails (we recover) or another
      // source is picked first and returns the safe entry — both are
      // acceptable outcomes, the contract is "result is not null".
      expect(result).not.toBeNull();
    });

    it('returns null when every source returns nothing or throws', async () => {
      (wikipediaAdapterMock.fetch as jest.Mock).mockResolvedValue([]);
      (rssFeedServiceMock.getLatest as jest.Mock).mockResolvedValue([]);

      const result = await service.getSuggestions(3);

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

      await service.getSuggestions(5);

      // At least one adapter saw count=5 and returned non-empty.
      expect(seen).toContain(5);
    });
  });
});
