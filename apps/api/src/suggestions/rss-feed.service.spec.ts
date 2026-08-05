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

const RSS_XML_WITH_STYLED_TITLE = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Sample Feed</title>
    <item>
      <title><![CDATA[Why the <i>Cyclospora</i> Outbreak Is Hard to Pin Down]]></title>
      <link>https://example.com/styled-title</link>
      <description>Some description.</description>
      <pubDate>Wed, 28 May 2026 12:00:00 GMT</pubDate>
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

const RSS_XML_WITH_UNSAFE_SCHEMES = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Sample Feed</title>
    <item>
      <title>Hostile Link</title>
      <link>javascript:alert(1)</link>
      <description>Should never be persisted.</description>
      <pubDate>Wed, 28 May 2026 12:00:00 GMT</pubDate>
    </item>
    <item>
      <title>Hostile Image</title>
      <link>https://example.com/safe</link>
      <description>Link is fine, enclosure is not.</description>
      <pubDate>Tue, 27 May 2026 09:00:00 GMT</pubDate>
      <enclosure url="data:image/svg+xml,&lt;svg/&gt;" />
    </item>
  </channel>
</rss>`;

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
      createMany: jest.fn(),
      updateMany: jest.fn(),
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
    it('inserts all-new items via a single createMany and skips updateMany', async () => {
      fetchMock.mockResolvedValueOnce(textResponse(RSS_XML));
      // no existing rows: all created fresh; updateMany must not fire
      (prismaMock.rssEntry.findMany as jest.Mock).mockResolvedValueOnce([]);
      (prismaMock.rssEntry.createMany as jest.Mock).mockResolvedValue({
        count: 2,
      });

      await service.refreshOne({
        key: 'aeon',
        name: 'Aeon',
        type: 'latest',
        feedUrl: 'https://aeon.co/feed.rss',
        siteName: 'Aeon',
      });

      const createManyMock = prismaMock.rssEntry.createMany as jest.Mock;
      expect(createManyMock).toHaveBeenCalledTimes(1);

      const createCall = createManyMock.mock.calls[0][0] as {
        data: Array<{
          sourceKey: string;
          url: string;
          title: string;
          imageUrl: string | null;
          siteName: string;
        }>;
      };
      expect(createCall.data).toHaveLength(2);
      expect(createCall.data[0]).toMatchObject({
        sourceKey: 'aeon',
        url: 'https://example.com/first',
        title: 'First Item',
        imageUrl: 'https://example.com/first.jpg',
        siteName: 'Aeon',
      });
      expect(
        prismaMock.rssEntry.updateMany as jest.Mock,
      ).not.toHaveBeenCalled();
    });

    it('strips embedded style tags out of item titles', async () => {
      fetchMock.mockResolvedValueOnce(textResponse(RSS_XML_WITH_STYLED_TITLE));
      (prismaMock.rssEntry.findMany as jest.Mock).mockResolvedValueOnce([]);
      (prismaMock.rssEntry.createMany as jest.Mock).mockResolvedValue({
        count: 1,
      });

      await service.refreshOne({
        key: 'nautilus',
        name: 'Nautilus',
        type: 'latest',
        feedUrl: 'https://nautil.us/feed.rss',
        siteName: 'Nautilus',
      });

      const createCall = (prismaMock.rssEntry.createMany as jest.Mock).mock
        .calls[0][0] as { data: Array<{ title: string }> };
      expect(createCall.data[0].title).toBe(
        'Why the Cyclospora Outbreak Is Hard to Pin Down',
      );
    });

    it('passes skipDuplicates so a racing duplicate insert does not throw the whole batch', async () => {
      fetchMock.mockResolvedValueOnce(textResponse(RSS_XML));
      // concurrent insert collides; skipDuplicates skips it, no P2002 batch fail
      (prismaMock.rssEntry.findMany as jest.Mock).mockResolvedValueOnce([]);
      (prismaMock.rssEntry.createMany as jest.Mock).mockResolvedValue({
        count: 1,
      });

      await service.refreshOne({
        key: 'aeon',
        name: 'Aeon',
        type: 'latest',
        feedUrl: 'https://aeon.co/feed.rss',
        siteName: 'Aeon',
      });

      const createCall = (prismaMock.rssEntry.createMany as jest.Mock).mock
        .calls[0][0] as { skipDuplicates?: boolean };
      expect(createCall.skipDuplicates).toBe(true);
    });

    it('issues one updateMany per pre-existing item and skips createMany for them', async () => {
      fetchMock.mockResolvedValueOnce(textResponse(RSS_XML));
      // both URLs already exist: updateMany per row, createMany skipped
      (prismaMock.rssEntry.findMany as jest.Mock).mockResolvedValueOnce([
        { url: 'https://example.com/first' },
        { url: 'https://example.com/second' },
      ]);
      (prismaMock.rssEntry.updateMany as jest.Mock).mockResolvedValue({
        count: 1,
      });

      await service.refreshOne({
        key: 'aeon',
        name: 'Aeon',
        type: 'latest',
        feedUrl: 'https://aeon.co/feed.rss',
        siteName: 'Aeon',
      });

      const updateManyMock = prismaMock.rssEntry.updateMany as jest.Mock;
      expect(updateManyMock).toHaveBeenCalledTimes(2);

      const firstCall = updateManyMock.mock.calls[0][0] as {
        where: { sourceKey: string; url: string };
        data: { title: string };
      };
      expect(firstCall.where).toEqual({
        sourceKey: 'aeon',
        url: 'https://example.com/first',
      });
      expect(firstCall.data.title).toBe('First Item');

      expect(
        prismaMock.rssEntry.createMany as jest.Mock,
      ).not.toHaveBeenCalled();
    });

    it('parses Atom feeds and persists entries', async () => {
      fetchMock.mockResolvedValueOnce(textResponse(ATOM_XML));
      (prismaMock.rssEntry.findMany as jest.Mock).mockResolvedValueOnce([]);
      (prismaMock.rssEntry.createMany as jest.Mock).mockResolvedValue({
        count: 1,
      });

      await service.refreshOne({
        key: 'colossal',
        name: 'Colossal',
        type: 'latest',
        feedUrl: 'https://www.thisiscolossal.com/feed',
        siteName: 'Colossal',
      });

      const createManyMock = prismaMock.rssEntry.createMany as jest.Mock;
      expect(createManyMock).toHaveBeenCalledTimes(1);

      const createCall = createManyMock.mock.calls[0][0] as {
        data: Array<{ url: string; title: string; publishedAt: Date }>;
      };
      expect(createCall.data).toHaveLength(1);
      expect(createCall.data[0].url).toBe('https://example.com/atom-entry');
      expect(createCall.data[0].title).toBe('Atom Entry');
      expect(createCall.data[0].publishedAt).toBeInstanceOf(Date);
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

    // a feed we do not control can hand us any scheme it likes
    it('drops an item whose link is not http(s) and nulls an unsafe image', async () => {
      fetchMock.mockResolvedValueOnce(
        textResponse(RSS_XML_WITH_UNSAFE_SCHEMES),
      );
      (prismaMock.rssEntry.findMany as jest.Mock).mockResolvedValueOnce([]);
      (prismaMock.rssEntry.createMany as jest.Mock).mockResolvedValue({
        count: 1,
      });

      await service.refreshOne({
        key: 'aeon',
        name: 'Aeon',
        type: 'latest',
        feedUrl: 'https://aeon.co/feed.rss',
        siteName: 'Aeon',
      });

      const createCall = (prismaMock.rssEntry.createMany as jest.Mock).mock
        .calls[0][0] as {
        data: Array<{ url: string; imageUrl: string | null }>;
      };
      expect(createCall.data).toHaveLength(1);
      expect(createCall.data[0]).toMatchObject({
        url: 'https://example.com/safe',
        imageUrl: null,
      });
    });

    it('persists all N entries when the feed returns N items', async () => {
      const items = Array.from(
        { length: 10 },
        (_, index) => `
        <item>
          <title>Item ${index + 1}</title>
          <link>https://example.com/item-${index + 1}</link>
          <pubDate>Wed, 28 May 2026 12:00:00 GMT</pubDate>
        </item>
      `,
      ).join('');

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
        <rss version="2.0"><channel><title>Big Feed</title>${items}</channel></rss>`;

      fetchMock.mockResolvedValueOnce(textResponse(xml));
      (prismaMock.rssEntry.findMany as jest.Mock).mockResolvedValueOnce([]);
      (prismaMock.rssEntry.createMany as jest.Mock).mockResolvedValue({
        count: 10,
      });

      await service.refreshOne({
        key: 'aeon',
        name: 'Aeon',
        type: 'latest',
        feedUrl: 'https://aeon.co/feed.rss',
        siteName: 'Aeon',
      });

      const createCall = (prismaMock.rssEntry.createMany as jest.Mock).mock
        .calls[0][0] as { data: unknown[] };
      expect(createCall.data).toHaveLength(10);
      expect(
        prismaMock.rssEntry.updateMany as jest.Mock,
      ).not.toHaveBeenCalled();
    });

    it('dedups same-batch duplicate URLs so two parallel updateMany cannot race the same row', async () => {
      const duplicateXml = `<?xml version="1.0" encoding="UTF-8"?>
        <rss version="2.0"><channel><title>Duplicates</title>
          <item>
            <title>Earlier headline</title>
            <link>https://example.com/dup</link>
          </item>
          <item>
            <title>Revised headline</title>
            <link>https://example.com/dup</link>
          </item>
        </channel></rss>`;

      fetchMock.mockResolvedValueOnce(textResponse(duplicateXml));
      (prismaMock.rssEntry.findMany as jest.Mock).mockResolvedValueOnce([
        { url: 'https://example.com/dup' },
      ]);
      (prismaMock.rssEntry.updateMany as jest.Mock).mockResolvedValue({
        count: 1,
      });

      await service.refreshOne({
        key: 'aeon',
        name: 'Aeon',
        type: 'latest',
        feedUrl: 'https://aeon.co/feed.rss',
        siteName: 'Aeon',
      });

      const updateManyMock = prismaMock.rssEntry.updateMany as jest.Mock;
      // same URL twice: dedup to one update; later item wins
      expect(updateManyMock).toHaveBeenCalledTimes(1);
      const call = updateManyMock.mock.calls[0][0] as {
        data: { title: string };
      };
      expect(call.data.title).toBe('Revised headline');
    });
  });

  describe('refreshAll', () => {
    it('does not throw when a source fails – failures are isolated', async () => {
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
