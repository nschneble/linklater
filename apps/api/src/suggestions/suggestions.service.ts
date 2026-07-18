import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { isTestingUi } from '../common/testing-ui.js';
import { PrismaService } from '../prisma/index.js';
import { QueueService, RECURRING_JOB_RETRY_OPTIONS } from '../queue/index.js';
import { RssAdapter } from './rss-adapter.js';
import { RssFeedService } from './rss-feed.service.js';
import { SOURCES, type SourceDefinition } from './sources.js';
import { WikipediaAdapter } from './wikipedia-adapter.js';
import type { SourceAdapter, Suggestion } from './suggestions.types.js';

/**
 * Frozen suggestion pool returned in TESTING_UI mode. Exported so tuffgal
 * fixtures can avoid writing colliding `Link.url` rows for the test user
 * – a fixture sharing one of these URLs would be filtered out and would
 * shrink the deterministic suggestion set unexpectedly.
 */
export const TESTING_UI_SUGGESTION_POOL: readonly Suggestion[] = [
  {
    title: 'Testing-UI Determinism',
    url: 'https://example.test/articles/testing-ui-determinism',
    description:
      'A frozen sample article used by the testing-ui harness so screenshot diffs only flag genuine UI changes.',
    imageUrl: null,
    siteName: 'Testing Fixture',
  },
  {
    title: 'A Note on Sample Suggestions',
    url: 'https://example.test/articles/sample-suggestions',
    description: 'Another stable placeholder for visual regression runs.',
    imageUrl: null,
    siteName: 'Testing Fixture',
  },
];

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
    private readonly prisma: PrismaService,
  ) {
    this.adapters = this.buildAdapters();
  }

  async onModuleInit(): Promise<void> {
    // In testing-ui mode we never want network calls to flaky external
    // sources or the recurring refresh job competing for the test database
    // – both would inject non-determinism into visual baselines.
    if (isTestingUi()) {
      this.logger.log(
        'TESTING_UI=1: skipping RSS scheduling and bootstrap refresh.',
      );
      return;
    }
    await this.queueService.schedule(
      RSS_REFRESH_QUEUE,
      RSS_REFRESH_CRON,
      undefined,
      RECURRING_JOB_RETRY_OPTIONS,
    );
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
   * from it, excluding any URL the user already has saved (read or
   * unread). On empty results, adapter errors, or every entry being a
   * duplicate of an existing link, removes the failed source from the
   * candidate pool and retries until either the pool is exhausted or a
   * source returns at least one fresh suggestion.
   *
   * @param count - Maximum number of suggestions to return.
   * @param userId - Authenticated user, used to filter out already-saved
   * URLs so a stumble never surfaces something the user has bookmarked.
   * @returns `{ sourceName, suggestions }`. `suggestions` may have fewer
   * than `count` entries if the chosen source had less to offer after
   * the duplicate filter. `null` if no source had anything fresh –
   * caller treats this as a soft failure and renders a napping fallback.
   */
  async getSuggestions(
    count: number,
    userId: string,
  ): Promise<{ sourceName: string; suggestions: Suggestion[] } | null> {
    if (isTestingUi()) {
      return this.deterministicTestSuggestions(count, userId);
    }
    const candidates = [...this.adapters.values()];

    while (candidates.length > 0) {
      const index = Math.floor(Math.random() * candidates.length);
      const adapter = candidates[index];
      candidates.splice(index, 1);

      try {
        const suggestions = await adapter.fetch(count);
        if (suggestions.length === 0) {
          this.logger.warn(
            `Source ${adapter.key} returned no suggestions; trying another.`,
          );
          continue;
        }

        const fresh = await this.filterAlreadySaved(suggestions, userId);
        if (fresh.length > 0) {
          return { sourceName: adapter.name, suggestions: fresh };
        }
        this.logger.warn(
          `Source ${adapter.key} produced only duplicates of saved links; trying another.`,
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
   * Returns a fixed, content-stable suggestion set for the testing-ui
   * harness. Avoids random source selection + network I/O, and still
   * runs the candidate set through `filterAlreadySaved` so the contract
   * matches the production path (a fixture that saves one of the pool
   * URLs would otherwise see it surfaced as a duplicate). If everything
   * is filtered out, falls back to the first pool entry so the callout
   * always has something to render.
   */
  private async deterministicTestSuggestions(
    count: number,
    userId: string,
  ): Promise<{ sourceName: string; suggestions: Suggestion[] }> {
    const pool: Suggestion[] = [...TESTING_UI_SUGGESTION_POOL];
    const wanted = Math.max(1, Math.min(count, pool.length));
    const candidate = pool.slice(0, wanted);
    const fresh = await this.filterAlreadySaved(candidate, userId);
    return {
      sourceName: 'Testing Fixture',
      suggestions: fresh.length > 0 ? fresh : [pool[0]],
    };
  }

  /**
   * Removes suggestions whose URL already exists on the user's `Link`
   * table (across both read and unread states). Done as a single bulk
   * `findMany ... where url IN (...)` so the cost is one query per
   * candidate batch regardless of `count`.
   */
  private async filterAlreadySaved(
    suggestions: Suggestion[],
    userId: string,
  ): Promise<Suggestion[]> {
    const urls = suggestions.map((suggestion) => suggestion.url);
    const existing = await this.prisma.link.findMany({
      where: { userId, url: { in: urls } },
      select: { url: true },
    });
    const taken = new Set(existing.map((link) => link.url));
    return suggestions.filter((suggestion) => !taken.has(suggestion.url));
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
