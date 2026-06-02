import { jest } from '@jest/globals';

jest.mock('../prisma/prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../prisma/generated/client', () => ({ Prisma: {} }));

import { Test, type TestingModule } from '@nestjs/testing';

import { PrismaService } from '../prisma/prisma.service';
import { RssFeedService } from './rss-feed.service';

const RSS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>Sample Feed</title>
    <item>
      <title>First Item</title>
      <link>https://example.com/first</link>
      <description>This is the first description.</description>
      <pubDate>Wed, 28 May 2026 12:00:00 GMT</pubDate>
      <enclosure url="https://example.com/first.jpg" />
    </item>
    <item>
      <title>Second Item</title>
      <link>https://example.com/second</link>
      <description><![CDATA[Second body with <em>HTML</em>.]]></description>
      <pubDate>Tue, 27 May 2026 09:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

const ATOM_XML = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Sample Atom</title>
  <entry>
    <title>Atom Entry</title>
    <link href="https://example.com/atom-entry" />
    <summary>Atom summary text.</summary>
    <updated>2026-05-29T10:00:00Z</updated>
  </entry>
</feed>`;

function textResponse(body: string, ok = true, status = 200): Response {
  return {
    ok,
    status,
    text: async () => body,
  } as Response;
}

describe('RssFeedService', () => {
  let service: RssFeedService;
  let fetchMock: jest.Mock;

  const prismaMock = {
    rssEntry: {
      upsert: jest.fn(),
      findMany: jest.fn(),
    },
  } as unknown as PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RssFeedService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<RssFeedService>(RssFeedService);
    fetchMock = jest.fn();
    (global as { fetch: unknown }).fetch = fetchMock;
    jest.clearAllMocks();
  });

  describe('refreshOne', () => {
    it('parses an RSS 2.0 feed and upserts each item', async () => {
      fetchMock.mockResolvedValueOnce(textResponse(RSS_XML));

      await service.refreshOne({
        key: 'aeon',
        name: 'Aeon',
        type: 'latest',
        feedUrl: 'https://aeon.co/feed.rss',
        siteName: 'Aeon',
      });

      const upsertMock = prismaMock.rssEntry.upsert as jest.Mock;
      expect(upsertMock).toHaveBeenCalledTimes(2);

      const firstCall = upsertMock.mock.calls[0][0] as {
        where: { sourceKey_url: { sourceKey: string; url: string } };
        create: { title: string; imageUrl: string | null; siteName: string };
      };
      expect(firstCall.where.sourceKey_url).toEqual({
        sourceKey: 'aeon',
        url: 'https://example.com/first',
      });
      expect(firstCall.create.title).toBe('First Item');
      expect(firstCall.create.imageUrl).toBe('https://example.com/first.jpg');
      expect(firstCall.create.siteName).toBe('Aeon');
    });

    it('parses Atom feeds', async () => {
      fetchMock.mockResolvedValueOnce(textResponse(ATOM_XML));

      await service.refreshOne({
        key: 'colossal',
        name: 'Colossal',
        type: 'latest',
        feedUrl: 'https://www.thisiscolossal.com/feed',
        siteName: 'Colossal',
      });

      const upsertMock = prismaMock.rssEntry.upsert as jest.Mock;
      expect(upsertMock).toHaveBeenCalledTimes(1);

      const call = upsertMock.mock.calls[0][0] as {
        create: { url: string; title: string; publishedAt: Date };
      };
      expect(call.create.url).toBe('https://example.com/atom-entry');
      expect(call.create.title).toBe('Atom Entry');
      expect(call.create.publishedAt).toBeInstanceOf(Date);
    });

    it('throws when the feed returns a non-OK status', async () => {
      fetchMock.mockResolvedValueOnce(textResponse('', false, 503));

      await expect(
        service.refreshOne({
          key: 'aeon',
          name: 'Aeon',
          type: 'latest',
          feedUrl: 'https://aeon.co/feed.rss',
          siteName: 'Aeon',
        }),
      ).rejects.toThrow(/503/);
    });

    it('rejects sources that are not RSS-typed', async () => {
      await expect(
        service.refreshOne({
          key: 'wikipedia',
          name: 'Wikipedia',
          type: 'random',
        }),
      ).rejects.toThrow(/non-RSS source/);
    });
  });

  describe('refreshAll', () => {
    it('does not throw when a source fails — failures are isolated', async () => {
      fetchMock.mockRejectedValue(new Error('network'));

      await expect(service.refreshAll()).resolves.not.toThrow();
    });
  });

  describe('getLatest', () => {
    it('returns up to count entries ordered by publishedAt desc', async () => {
      (prismaMock.rssEntry.findMany as jest.Mock).mockResolvedValueOnce([
        {
          url: 'https://example.com/a',
          title: 'A',
          description: 'desc a',
          imageUrl: null,
          siteName: 'Aeon',
        },
        {
          url: 'https://example.com/b',
          title: 'B',
          description: 'desc b',
          imageUrl: 'https://example.com/b.jpg',
          siteName: 'Aeon',
        },
      ]);

      const suggestions = await service.getLatest('aeon', 5);

      expect(suggestions).toHaveLength(2);
      expect(suggestions[0]).toEqual({
        url: 'https://example.com/a',
        title: 'A',
        description: 'desc a',
        imageUrl: null,
        siteName: 'Aeon',
      });

      const callArguments = (prismaMock.rssEntry.findMany as jest.Mock).mock
        .calls[0][0] as {
        where: { sourceKey: string };
        orderBy: { publishedAt: 'desc' };
        take: number;
      };
      expect(callArguments.where.sourceKey).toBe('aeon');
      expect(callArguments.orderBy.publishedAt).toBe('desc');
      expect(callArguments.take).toBe(5);
    });

    it('returns an empty array when the cache is empty', async () => {
      (prismaMock.rssEntry.findMany as jest.Mock).mockResolvedValueOnce([]);

      const suggestions = await service.getLatest('aeon', 3);

      expect(suggestions).toEqual([]);
    });
  });
});
