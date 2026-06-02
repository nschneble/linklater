import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { QueueService } from '../queue/index.js';
import { RssAdapter } from './rss-adapter.js';
import { RssFeedService } from './rss-feed.service.js';
import { SOURCES, type SourceDefinition } from './sources.js';
import { WikipediaAdapter } from './wikipedia-adapter.js';
import type { SourceAdapter, Suggestion } from './suggestions.types.js';

/** Queue name for the recurring RSS refresh. */
const RSS_REFRESH_QUEUE = 'rss-refresh';

/**
 * Cron expression: every six hours starting at minute 0. Aligns with the
 * cadence specified in the PRD.
 */
const RSS_REFRESH_CRON = '0 */6 * * *';

/**
 * The public-facing service that drives the Stumble empty state and the
 * unread-list callout. Picks one source uniformly at random and asks its
 * adapter for `count` suggestions; on adapter failure (or an empty
 * result) it removes that source from the pool and retries with another.
 *
 * On module init it also:
 * 1. Registers the recurring RSS refresh job + worker (every six hours).
 * 2. Kicks off a one-shot refresh immediately so a fresh deploy has cache
 *    data without waiting up to six hours for the first scheduled tick.
 */
@Injectable()
export class SuggestionsService implements OnModuleInit {
  private readonly logger = new Logger(SuggestionsService.name);
  private readonly adapters: Map<string, SourceAdapter>;

  constructor(
    private readonly rssFeedService: RssFeedService,
    private readonly wikipediaAdapter: WikipediaAdapter,
    private readonly queueService: QueueService,
  ) {
    this.adapters = this.buildAdapters();
  }

  async onModuleInit(): Promise<void> {
    await this.queueService.schedule(RSS_REFRESH_QUEUE, RSS_REFRESH_CRON);
    await this.queueService.work(RSS_REFRESH_QUEUE, async () => {
      await this.rssFeedService.refreshAll();
    });

    // Bootstrap: refresh feeds immediately so the cache is populated on a
    // fresh deploy. Awaited inside an IIFE that swallows errors so a flaky
    // network at boot does not block app startup.
    void (async () => {
      try {
        await this.rssFeedService.refreshAll();
      } catch (error) {
        this.logger.warn(
          `Bootstrap RSS refresh failed: ${String(error)}. The scheduled job will retry.`,
        );
      }
    })();
  }

  /**
   * Picks one source uniformly at random and returns `count` suggestions
   * from it. On empty results or adapter errors, removes the failed source
   * from the candidate pool and retries until either the pool is exhausted
   * or a source returns at least one suggestion.
   *
   * @returns `{ sourceName, suggestions }`. `suggestions` may have fewer
   * than `count` entries if the chosen source had less to offer. `null`
   * if no source had anything — caller treats this as a soft failure.
   */
  async getSuggestions(
    count: number,
  ): Promise<{ sourceName: string; suggestions: Suggestion[] } | null> {
    const candidates = [...this.adapters.values()];

    while (candidates.length > 0) {
      const index = Math.floor(Math.random() * candidates.length);
      const adapter = candidates[index];
      candidates.splice(index, 1);

      try {
        const suggestions = await adapter.fetch(count);
        if (suggestions.length > 0) {
          return { sourceName: adapter.name, suggestions };
        }
        this.logger.warn(
          `Source ${adapter.key} returned no suggestions; trying another.`,
        );
      } catch (error) {
        this.logger.warn(
          `Source ${adapter.key} failed: ${String(error)}; trying another.`,
        );
      }
    }

    return null;
  }

  /**
   * Builds the adapter registry from the source list. Wikipedia uses its
   * dedicated adapter; every `latest` source gets its own `RssAdapter`
   * instance bound to the shared `RssFeedService`.
   */
  private buildAdapters(): Map<string, SourceAdapter> {
    const adapters = new Map<string, SourceAdapter>();
    for (const source of SOURCES) {
      const adapter = this.adapterFor(source);
      adapters.set(adapter.key, adapter);
    }
    return adapters;
  }

  private adapterFor(source: SourceDefinition): SourceAdapter {
    if (source.type === 'random') {
      return this.wikipediaAdapter;
    }
    return new RssAdapter(source, this.rssFeedService);
  }
}
