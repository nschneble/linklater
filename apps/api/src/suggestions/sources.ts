/**
 * The fixed registry of suggestion sources. The Stumble empty state and the
 * unread-list callout both pick a source uniformly at random from this list.
 *
 * Wikipedia is treated as a `random` source – each fetch hits the random
 * article API and returns a fresh pick. The five RSS sources are `latest`
 * – entries are cached in the `RssEntry` table by a scheduled pg-boss job
 * and served from there.
 *
 * To add a source: append an entry below, then either (for RSS) the
 * scheduled refresh job will pick it up on its next tick, or (for a custom
 * source type) extend the SourceAdapter union and wire a new adapter.
 */
export interface SourceDefinition {
  /** Stable identifier used as the foreign key on `RssEntry.sourceKey`. */
  key: string;
  /** Human-readable display name shown in the UI ("How about something from {name}?"). */
  name: string;
  /** `random` sources are queried live each call; `latest` sources read from the cache. */
  type: 'random' | 'latest';
  /** RSS/Atom feed URL. Required for `latest` sources; ignored for `random`. */
  feedUrl?: string;
  /** Fallback site name applied to entries when the feed itself does not declare one. */
  siteName?: string;
}

export const SOURCES: readonly SourceDefinition[] = [
  {
    key: 'wikipedia',
    name: 'Wikipedia',
    type: 'random',
    siteName: 'Wikipedia',
  },
  {
    key: 'aeon',
    name: 'Aeon',
    type: 'latest',
    feedUrl: 'https://aeon.co/feed.rss',
    siteName: 'Aeon',
  },
  {
    key: 'atlas-obscura',
    name: 'Atlas Obscura',
    type: 'latest',
    feedUrl: 'https://www.atlasobscura.com/feeds/latest',
    siteName: 'Atlas Obscura',
  },
  {
    key: 'colossal',
    name: 'Colossal',
    type: 'latest',
    feedUrl: 'https://www.thisiscolossal.com/feed',
    siteName: 'Colossal',
  },
  {
    key: 'low-tech-magazine',
    name: 'Low-Tech Magazine',
    type: 'latest',
    feedUrl: 'https://solar.lowtechmagazine.com/posts/index.xml',
    siteName: 'Low-Tech Magazine',
  },
  {
    key: 'nautilus',
    name: 'Nautilus',
    type: 'latest',
    feedUrl: 'https://nautil.us/feed/',
    siteName: 'Nautilus',
  },
] as const;

/** Returns the RSS sources only – useful for the refresh job iteration. */
export const RSS_SOURCES: readonly SourceDefinition[] = SOURCES.filter(
  (source) => source.type === 'latest',
);
