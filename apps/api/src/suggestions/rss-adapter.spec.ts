import { jest } from '@jest/globals';

import { RssAdapter } from './rss-adapter.js';
import type { RssFeedService } from './rss-feed.service.js';
import type { SourceDefinition } from './sources.js';
import type { Suggestion } from './suggestions.types.js';

const makeRssFeedService = (
  suggestions: Suggestion[] = [],
): jest.Mocked<Pick<RssFeedService, 'getLatest'>> => ({
  getLatest: jest.fn().mockResolvedValue(suggestions),
});

const makeLatestSource = (
  overrides: Partial<SourceDefinition> = {},
): SourceDefinition => ({
  key: 'aeon',
  name: 'Aeon',
  type: 'latest',
  feedUrl: 'https://aeon.co/feed.rss',
  ...overrides,
});

describe('RssAdapter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('sets key and name from the source definition', () => {
      const service = makeRssFeedService();
      const adapter = new RssAdapter(
        makeLatestSource(),
        service as unknown as RssFeedService,
      );

      expect(adapter.key).toBe('aeon');
      expect(adapter.name).toBe('Aeon');
    });

    it('throws when constructed with a non-RSS source type', () => {
      const service = makeRssFeedService();
      const randomSource = makeLatestSource({
        type: 'random',
        key: 'wikipedia',
      });

      expect(
        () =>
          new RssAdapter(randomSource, service as unknown as RssFeedService),
      ).toThrow('RssAdapter constructed for non-RSS source: wikipedia');
    });
  });

  describe('fetch', () => {
    it('delegates to RssFeedService.getLatest with the correct key and count', async () => {
      const suggestions: Suggestion[] = [
        {
          url: 'https://aeon.co/article',
          title: 'Test Article',
          description: null,
          imageUrl: null,
          siteName: 'Aeon',
        },
      ];
      const service = makeRssFeedService(suggestions);
      const adapter = new RssAdapter(
        makeLatestSource(),
        service as unknown as RssFeedService,
      );

      const result = await adapter.fetch(3);

      expect(service.getLatest).toHaveBeenCalledWith('aeon', 3);
      expect(result).toEqual(suggestions);
    });

    it('returns an empty array when the cache is empty', async () => {
      const service = makeRssFeedService([]);
      const adapter = new RssAdapter(
        makeLatestSource(),
        service as unknown as RssFeedService,
      );

      const result = await adapter.fetch(5);

      expect(result).toEqual([]);
    });
  });
});
