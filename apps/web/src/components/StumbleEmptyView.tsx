import { FOCUS_RING } from '../lib/styles';
import { Link } from 'react-router-dom';
import LinkCard from './LinkCard';
import { useEffect, useState } from 'react';
import type { Link as SavedLink } from '../lib/api';

interface WikipediaArticle {
  title: string;
  extract: string;
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

function WikipediaCardSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading article"
      className="relative overflow-visible pl-10 pr-8 py-4 bg-[var(--bg-surface)] border-l-4 border-[var(--accent)] rounded-r-xl"
    >
      <div className="absolute left-0 top-4 -translate-x-1/2 w-8 h-8 rounded-2xl bg-[var(--accent)]" />
      <div className="space-y-1 animate-pulse">
        <div className="flex flex-row items-center">
          <div className="w-[60px] sm:w-[120px] h-[32px] sm:h-[63px] rounded-md bg-[var(--bg-elevated)] shrink-0" />
          <div className="flex flex-col items-start min-w-0 ml-3 gap-1.5 w-full">
            <div className="w-3/4 h-3.5 bg-[var(--bg-elevated)] rounded" />
            <div className="w-24 h-3 bg-[var(--bg-elevated)] rounded" />
          </div>
        </div>
        <div className="h-8 mt-2 space-y-1">
          <div className="w-full h-3 bg-[var(--bg-elevated)] rounded" />
          <div className="w-2/3 h-3 bg-[var(--bg-elevated)] rounded" />
        </div>
      </div>
    </div>
  );
}

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

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 py-12 bg-[var(--bg)] text-[var(--text)] text-center select-none">
      <div className="mb-8">
        <PixelArtGhost />
      </div>

      <h1 className="mb-2 text-xl font-semibold">
        Boo. Your reading list is empty.
      </h1>
      <p className="mb-8 text-[var(--text-muted)] text-sm max-w-xs">
        {loading ? 'Fetching curiousities…' : 'How about one of these?'}
      </p>

      <ul className="w-full max-w-md space-y-3 text-left mb-10">
        {loading ? (
          <>
            <li>
              <WikipediaCardSkeleton />
            </li>
            <li>
              <WikipediaCardSkeleton />
            </li>
            <li>
              <WikipediaCardSkeleton />
            </li>
          </>
        ) : articles.length > 0 ? (
          articles.map((article) => (
            <li key={article.url}>
              <LinkCard link={articleToLink(article)} onReadToggle={() => {}} />
            </li>
          ))
        ) : (
          <li className="text-center">
            <p className="text-[var(--text-subtle)] text-xs italic">
              (Wikipedia seems to be napping too.)
            </p>
          </li>
        )}
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
