import type { RssFeedService } from './rss-feed.service.js';
import type { SourceAdapter, Suggestion } from './suggestions.types.js';
import type { SourceDefinition } from './sources.js';

/**
 * Source adapter that serves cached RSS entries. Constructed per-source by
 * `SuggestionsService` so a single `RssFeedService` powers all five RSS
 * sources without further branching.
 *
 * `fetch(count)` is read-only; refreshes happen on the scheduled job, not
 * inline. If the cache is empty (fresh deploy before bootstrap refresh)
 * this returns `[]` and `SuggestionsService` falls through to another
 * source.
 */
export class RssAdapter implements SourceAdapter {
  readonly key: string;
  readonly name: string;

  constructor(
    source: SourceDefinition,
    private readonly rssFeedService: RssFeedService,
  ) {
    if (source.type !== 'latest') {
      throw new Error(
        `RssAdapter constructed for non-RSS source: ${source.key}`,
      );
    }
    this.key = source.key;
    this.name = source.name;
  }

  async fetch(count: number): Promise<Suggestion[]> {
    return this.rssFeedService.getLatest(this.key, count);
  }
}
