import type { Link as SavedLink } from './api';

export interface WikipediaArticle {
  title: string;
  extract: string;
  url: string;
}

export const WIKIPEDIA_IMAGE_URL =
  'https://cdn.brandfetch.io/idAo3WRIoq/w/200/h/183/theme/light/symbol.png?c=1bxid64Mup7aczewSAYMX&t=1679406648240';
export const WIKIPEDIA_FAVICON_URL =
  'https://cdn.brandfetch.io/idAo3WRIoq/w/64/h/64/theme/dark/icon.jpeg?c=1bxid64Mup7aczewSAYMX&t=1679406640804';

/**
 * Converts a `WikipediaArticle` into the `Link` shape that `LinkCard`
 * expects so the card component can be reused without modification.
 *
 * The link `id` is set to the article URL (always unique) to satisfy
 * React's `key` requirement without needing a real UUID. `readAt` is
 * `null` (unread appearance) since these are suggestions, not saved links.
 */
export function articleToLink(article: WikipediaArticle): SavedLink {
  const now = new Date().toISOString();
  return {
    id: article.url,
    url: article.url,
    createdAt: now,
    updatedAt: now,
    readAt: null,
    meta: {
      title: article.title,
      description: article.extract,
      imageUrl: WIKIPEDIA_IMAGE_URL,
      faviconUrl: WIKIPEDIA_FAVICON_URL,
      fetchedAt: now,
    },
  };
}

/**
 * Fetches a random article summary from the Wikipedia REST API.
 *
 * Returns `null` on any failure (network error, non-OK status, or aborted
 * request) so callers can degrade gracefully without surfacing errors.
 */
export async function fetchRandomWikipediaArticle(
  signal: AbortSignal,
): Promise<WikipediaArticle | null> {
  try {
    const response = await fetch(
      'https://en.wikipedia.org/api/rest_v1/page/random/summary',
      { signal },
    );
    if (!response.ok) return null;
    const data = (await response.json()) as {
      title: string;
      extract: string;
      content_urls: { desktop: { page: string } };
    };
    return {
      title: data.title,
      extract: data.extract,
      url: data.content_urls.desktop.page,
    };
  } catch {
    return null;
  }
}
