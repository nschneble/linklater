import { Injectable, Logger } from '@nestjs/common';
import Parser from 'rss-parser';

import { isSafeRedirectUrl } from '../common/index.js';
import { PrismaService } from '../prisma/index.js';
import { RSS_SOURCES, SOURCES, type SourceDefinition } from './sources.js';
import type { Suggestion } from './suggestions.types.js';

/**
 * How long an outgoing feed fetch may run before being aborted. RSS feeds
 * occasionally hang on slow CDN edges; bailing out preserves the refresh
 * job's responsiveness across the remaining sources.
 */
const FEED_FETCH_TIMEOUT_MS = 15_000;

/**
 * Subset of `rss-parser` item fields we map onto `Suggestion`. The library
 * returns many more fields (categories, enclosures, content snippets, etc.);
 * we ignore them all to keep the surface small.
 */
interface RawFeedItem {
  link?: string;
  title?: string;
  contentSnippet?: string;
  content?: string;
  summary?: string;
  isoDate?: string;
  pubDate?: string;
  enclosure?: { url?: string };
  ['media:content']?: { $?: { url?: string } };
}

interface RawFeed {
  items: RawFeedItem[];
}

/**
 * Pulls entries from external RSS/Atom feeds, parses them with
 * `rss-parser`, and upserts them into the `RssEntry` cache. A scheduled
 * pg-boss job (see `SuggestionsService.onModuleInit`) calls `refreshAll`
 * every six hours; the read path (`getLatest`) reads from the cache so
 * Stumble loads remain snappy and feed hosts are not hammered.
 */
@Injectable()
export class RssFeedService {
  private readonly logger = new Logger(RssFeedService.name);
  private readonly parser = new Parser();

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Refreshes every RSS source in the registry. Failures are isolated per
   * source – a broken Aeon feed does not block Atlas Obscura from
   * refreshing. Errors are logged at `warn` level.
   */
  async refreshAll(): Promise<void> {
    await Promise.all(
      RSS_SOURCES.map((source) =>
        this.refreshOne(source).catch((error: unknown) => {
          this.logger.warn(
            `RSS refresh failed for ${source.key}: ${String(error)}`,
          );
        }),
      ),
    );
  }

  /**
   * Refreshes a single source by key. Throws on parse or DB errors so the
   * caller can decide whether to log + continue (the batch case) or
   * surface the failure (a one-off refresh in tests, say).
   *
   * @param source - The source definition; must have `type: 'latest'`.
   */
  async refreshOne(source: SourceDefinition): Promise<void> {
    if (source.type !== 'latest' || !source.feedUrl) {
      throw new Error(`refreshOne called on non-RSS source: ${source.key}`);
    }

    const feed = await this.fetchAndParse(source.feedUrl);
    const now = new Date();

    const validItems = feed.items.flatMap((item) => {
      const suggestion = this.itemToSuggestion(item, source);
      if (!suggestion) return [];
      return [
        { suggestion, publishedAt: this.extractPublishedAt(item) ?? now },
      ];
    });

    // dedup by URL; a repeated <link> races two updateMany calls, last wins
    const byUrl = new Map<string, (typeof validItems)[number]>();
    for (const entry of validItems) {
      byUrl.set(entry.suggestion.url, entry);
    }
    const deduped = Array.from(byUrl.values());

    // partition new vs existing so the update pass skips freshly-inserted rows
    const existing = await this.prisma.rssEntry.findMany({
      where: {
        sourceKey: source.key,
        url: { in: deduped.map((entry) => entry.suggestion.url) },
      },
      select: { url: true },
    });
    const existingUrls = new Set(existing.map((entry) => entry.url));

    const toCreate = deduped.filter(
      (entry) => !existingUrls.has(entry.suggestion.url),
    );
    const toUpdate = deduped.filter((entry) =>
      existingUrls.has(entry.suggestion.url),
    );

    if (toCreate.length > 0) {
      // skipDuplicates: concurrent inserts collide, else P2002 fails the batch
      await this.prisma.rssEntry.createMany({
        data: toCreate.map(({ suggestion, publishedAt }) => ({
          sourceKey: source.key,
          url: suggestion.url,
          title: suggestion.title,
          description: suggestion.description,
          imageUrl: suggestion.imageUrl,
          siteName: suggestion.siteName,
          publishedAt,
          fetchedAt: now,
        })),
        skipDuplicates: true,
      });
    }

    if (toUpdate.length > 0) {
      await Promise.all(
        toUpdate.map(({ suggestion, publishedAt }) =>
          this.prisma.rssEntry.updateMany({
            where: { sourceKey: source.key, url: suggestion.url },
            data: {
              title: suggestion.title,
              description: suggestion.description,
              imageUrl: suggestion.imageUrl,
              siteName: suggestion.siteName,
              publishedAt,
              fetchedAt: now,
            },
          }),
        ),
      );
    }
  }

  /**
   * Reads the most recent `count` entries for a source from the cache.
   * Returns an empty array if the cache has not been populated yet
   * (e.g. immediately after a fresh deploy, before the bootstrap refresh
   * has run).
   *
   * @param sourceKey - The `SourceDefinition.key`.
   * @param count - The maximum number of entries to return.
   */
  async getLatest(sourceKey: string, count: number): Promise<Suggestion[]> {
    const entries = await this.prisma.rssEntry.findMany({
      where: { sourceKey },
      orderBy: { publishedAt: 'desc' },
      take: count,
    });
    return entries.map((entry) => ({
      url: entry.url,
      title: entry.title,
      description: entry.description,
      imageUrl: entry.imageUrl,
      siteName: entry.siteName,
    }));
  }

  /**
   * Looks up a source by key. Returned for use by tests and the adapter
   * factory – production code should prefer the registry-driven flows.
   */
  getSource(sourceKey: string): SourceDefinition | undefined {
    return SOURCES.find((source) => source.key === sourceKey);
  }

  private async fetchAndParse(feedUrl: string): Promise<RawFeed> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FEED_FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(feedUrl, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`Feed ${feedUrl} returned status ${response.status}`);
      }
      const xml = await response.text();
      return (await this.parser.parseString(xml)) as RawFeed;
    } finally {
      clearTimeout(timeout);
    }
  }

  private itemToSuggestion(
    item: RawFeedItem,
    source: SourceDefinition,
  ): Suggestion | null {
    const url = item.link?.trim();
    const title = this.stripHtml(item.title);
    // the feed is third-party, so its schemes are untrusted: a link we cannot
    // safely render is worth dropping, a bad image is worth only dropping
    if (!url || !title || !isSafeRedirectUrl(url)) return null;

    const description =
      item.contentSnippet?.trim() ||
      item.summary?.trim() ||
      this.stripHtml(item.content) ||
      null;

    const rawImageUrl =
      item.enclosure?.url ?? item['media:content']?.$?.url ?? null;
    const imageUrl = isSafeRedirectUrl(rawImageUrl) ? rawImageUrl : null;

    return {
      url,
      title,
      description,
      imageUrl,
      siteName: source.siteName ?? null,
    };
  }

  private extractPublishedAt(item: RawFeedItem): Date | null {
    const raw = item.isoDate ?? item.pubDate;
    if (!raw) return null;
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private stripHtml(content: string | undefined): string | null {
    if (!content) return null;
    const stripped = content
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return stripped.length > 0 ? stripped : null;
  }
}
