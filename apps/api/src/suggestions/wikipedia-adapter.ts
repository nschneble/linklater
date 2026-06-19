import { Injectable, Logger } from '@nestjs/common';

import type { SourceAdapter, Suggestion } from './suggestions.types.js';

const WIKIPEDIA_RANDOM_URL =
  'https://en.wikipedia.org/api/rest_v1/page/random/summary';

const WIKIPEDIA_FETCH_TIMEOUT_MS = 5000;

/**
 * Raw shape returned by the Wikipedia random summary endpoint. Only the
 * fields we actually surface are typed; the API returns much more.
 */
interface WikipediaSummary {
  title: string;
  extract: string;
  content_urls: { desktop: { page: string } };
  thumbnail?: { source: string };
}

/**
 * Source adapter for Wikipedia. Unlike the RSS adapters, this one hits the
 * Wikipedia REST API directly on every call – there is no DB cache because
 * the API itself returns a random article and that randomness IS the
 * feature. Caching would defeat the purpose.
 *
 * `fetch(count)` issues `count` parallel requests. Duplicate URLs are
 * dropped silently. A few hundred ms of latency per request is acceptable
 * because this only runs when the user lands on an empty Stumble or
 * unread-list view – not on the hot path.
 */
@Injectable()
export class WikipediaAdapter implements SourceAdapter {
  readonly key = 'wikipedia';
  readonly name = 'Wikipedia';
  private readonly logger = new Logger(WikipediaAdapter.name);

  async fetch(count: number): Promise<Suggestion[]> {
    const requests = Array.from({ length: count }, () =>
      this.fetchOne().catch((error: unknown) => {
        this.logger.warn(`Wikipedia fetch failed: ${String(error)}`);
        return null;
      }),
    );
    const results = await Promise.all(requests);
    const successful = results.filter(
      (suggestion): suggestion is Suggestion => suggestion !== null,
    );

    // Dedupe by URL – the random endpoint occasionally returns the same
    // article twice when called in quick succession.
    const seen = new Set<string>();
    return successful.filter((suggestion) => {
      if (seen.has(suggestion.url)) return false;
      seen.add(suggestion.url);
      return true;
    });
  }

  private async fetchOne(): Promise<Suggestion> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      WIKIPEDIA_FETCH_TIMEOUT_MS,
    );
    try {
      const response = await fetch(WIKIPEDIA_RANDOM_URL, {
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`Wikipedia returned status ${response.status}`);
      }
      const data = (await response.json()) as WikipediaSummary;
      return {
        url: data.content_urls.desktop.page,
        title: data.title,
        description: data.extract,
        imageUrl: data.thumbnail?.source ?? null,
        siteName: 'Wikipedia',
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
