import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FOCUS_RING } from '../lib/styles';
import LinkCard, { LinkCardSkeleton } from './LinkCard';
import type { Link as SavedLink } from '../lib/api';

/** A minimal subset of the Wikipedia REST API summary response. */
interface WikipediaArticle {
  /** The article's display title. */
  title: string;
  /** A short plain-text extract from the article's opening paragraph. */
  extract: string;
  /** The canonical desktop URL for the article. */
  url: string;
}

/**
 * 8×8 pixel-art ghost rendered as an SVG. Each logical pixel is 16×16 CSS
 * pixels. The palette is a sky-blue body (#bae6fd) with dark-blue eyes
 * (#0c4a6e).
 */
function PixelArtGhost() {
  const PIXEL = 16;
  const body = '#bae6fd';
  const eye = '#0c4a6e';

  // 0 = transparent, 1 = body, 2 = eye
  const grid = [
    [0, 0, 1, 1, 1, 1, 0, 0],
    [0, 1, 1, 1, 1, 1, 1, 0],
    [1, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 2, 1, 1, 2, 1, 1],
    [1, 1, 2, 1, 1, 2, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 1],
    [1, 0, 1, 0, 1, 0, 0, 0],
  ];

  const colorOf = (cell: number) => {
    if (cell === 1) return body;
    if (cell === 2) return eye;
    return null;
  };

  return (
    <svg
      width={8 * PIXEL}
      height={8 * PIXEL}
      viewBox={`0 0 ${8 * PIXEL} ${8 * PIXEL}`}
      aria-label="A friendly pixel-art ghost"
      role="img"
      style={{ imageRendering: 'pixelated' }}
    >
      {grid.map((row, rowIndex) =>
        row.map((cell, colIndex) => {
          const fill = colorOf(cell);
          if (!fill) return null;
          return (
            <rect
              key={`${rowIndex}-${colIndex}`}
              x={colIndex * PIXEL}
              y={rowIndex * PIXEL}
              width={PIXEL}
              height={PIXEL}
              fill={fill}
            />
          );
        }),
      )}
    </svg>
  );
}

const WIKIPEDIA_IMAGE_URL =
  'https://cdn.brandfetch.io/idAo3WRIoq/w/200/h/183/theme/light/symbol.png?c=1bxid64Mup7aczewSAYMX&t=1679406648240';
const WIKIPEDIA_FAVICON_URL =
  'https://cdn.brandfetch.io/idAo3WRIoq/w/64/h/64/theme/dark/icon.jpeg?c=1bxid64Mup7aczewSAYMX&t=1679406640804';

/**
 * Converts a `WikipediaArticle` into the `Link` shape that `LinkCard`
 * expects so the card component can be reused without modification.
 *
 * The link `id` is set to the article URL (always unique) to satisfy
 * React's `key` requirement without needing a real UUID. The `readAt`
 * and `userId` fields are not present in this context — `readAt` is
 * `null` (unread appearance) and the card's `onReadToggle` is a no-op.
 */
function articleToLink(article: WikipediaArticle): SavedLink {
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
 * Returns `null` on any failure (network error, non-OK status,
 * or an aborted request) so callers can degrade gracefully without
 * surfacing errors to the user.
 *
 * @param signal - An `AbortSignal` used to cancel the fetch when the
 *   component unmounts.
 * @returns A `WikipediaArticle` on success, or `null` on failure.
 */
async function fetchRandomWikipediaArticle(
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

/**
 * Full-page empty state shown by `StumblePage` when the user has no unread
 * links. Displays a pixel-art ghost, a playful message, and three randomly
 * fetched Wikipedia article snippets as consolation reading.
 *
 * Wikipedia fetch failures are swallowed silently. The page degrades
 * gracefully to a static fallback message.
 *
 * The loading skeleton reuses `LinkCardSkeleton` from `LinkCard` to avoid
 * duplicating the card-shaped placeholder markup.
 */
export default function StumbleEmptyView() {
  const [articles, setArticles] = useState<WikipediaArticle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    Promise.all([
      fetchRandomWikipediaArticle(controller.signal),
      fetchRandomWikipediaArticle(controller.signal),
      fetchRandomWikipediaArticle(controller.signal),
    ]).then((results) => {
      if (controller.signal.aborted) return;
      setArticles(
        results.filter(
          (article): article is WikipediaArticle => article !== null,
        ),
      );
      setLoading(false);
    });

    return () => controller.abort();
  }, []);

  function renderArticles() {
    if (loading) {
      return (
        <>
          <li>
            <LinkCardSkeleton />
          </li>
          <li>
            <LinkCardSkeleton />
          </li>
          <li>
            <LinkCardSkeleton />
          </li>
        </>
      );
    }
    if (articles.length > 0) {
      return articles.map((article) => (
        <li key={article.url}>
          <LinkCard link={articleToLink(article)} onReadToggle={() => {}} />
        </li>
      ));
    }
    return (
      <li className="text-center">
        <p className="text-[var(--text-subtle)] text-xs italic">
          (Wikipedia seems to be napping too.)
        </p>
      </li>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 py-12 bg-[var(--bg)] text-[var(--text)] text-center select-none">
      <div className="mb-8">
        <PixelArtGhost />
      </div>

      <h1 className="mb-2 text-xl font-semibold">
        Boo. Your reading list is empty.
      </h1>
      <p
        className="mb-8 text-[var(--text-muted)] text-sm max-w-xs"
        aria-live="polite"
        aria-atomic="true"
      >
        {loading ? 'Fetching curiousities…' : 'How about one of these?'}
      </p>

      <ul
        className="w-full max-w-md space-y-3 text-left mb-10"
        aria-label="Suggested reading from Wikipedia"
      >
        {renderArticles()}
      </ul>

      <Link
        to="/unread"
        className={`text-[var(--text-muted)] hover:text-[var(--text)] text-sm transition ${FOCUS_RING} rounded`}
      >
        ← Back to Linklater
      </Link>
    </div>
  );
}
