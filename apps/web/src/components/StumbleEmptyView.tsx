import { FOCUS_RING } from '../lib/styles';
import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';

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

async function fetchRandomWikipediaArticle(): Promise<WikipediaArticle | null> {
  try {
    const response = await fetch(
      'https://en.wikipedia.org/api/rest_v1/page/random/summary',
    );
    if (!response.ok) return null;
    const data = (await response.json()) as {
      title: string;
      extract: string;
      content_urls: { desktop: { page: string } };
    };
    return {
      title: data.title,
      extract: data.extract.slice(0, 120),
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
    Promise.all([
      fetchRandomWikipediaArticle(),
      fetchRandomWikipediaArticle(),
      fetchRandomWikipediaArticle(),
    ]).then((results) => {
      setArticles(
        results.filter(
          (article): article is WikipediaArticle => article !== null,
        ),
      );
      setLoading(false);
    });
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 py-12 bg-[var(--bg)] text-[var(--text)] text-center select-none">
      <div className="mb-8">
        <PixelArtGhost />
      </div>

      <h1 className="mb-2 text-xl font-semibold">
        Oops — your reading list is empty.
      </h1>
      <p className="mb-8 text-[var(--text-muted)] text-sm max-w-xs">
        Caught up! Impressive. Here&rsquo;s something to tide you over:
      </p>

      {loading && (
        <p className="text-[var(--text-subtle)] text-xs animate-pulse mb-8">
          Fetching curiosities…
        </p>
      )}

      {!loading && articles.length === 0 && (
        <p className="text-[var(--text-subtle)] text-xs italic mb-8">
          (Wikipedia seems to be napping too.)
        </p>
      )}

      {!loading && articles.length > 0 && (
        <ul className="w-full max-w-sm space-y-3 text-left mb-10">
          {articles.map((article) => (
            <li key={article.url}>
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`block px-4 py-3 bg-[var(--bg-elevated)] hover:bg-[var(--bg-surface)] border-shadow rounded-xl text-sm transition ${FOCUS_RING}`}
              >
                <div className="font-medium text-[var(--text)] mb-0.5">
                  {article.title}
                </div>
                <div className="text-[var(--text-muted)] text-xs line-clamp-2">
                  {article.extract}
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}

      <Link
        to="/unread"
        className={`text-[var(--text-muted)] hover:text-[var(--text)] text-sm transition ${FOCUS_RING} rounded`}
      >
        ← Back to Linklater
      </Link>
    </div>
  );
}
