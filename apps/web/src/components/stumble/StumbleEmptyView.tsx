import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FOCUS_RING } from '../../lib/styles';
import { fetchRandomWikipediaArticle } from '../../lib/wikipedia';
import type { WikipediaArticle } from '../../lib/wikipedia';
import WikipediaArticleList from './WikipediaArticleList';
import PixelArtGhost from './PixelArtGhost';

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

      <h1 className="mb-2 text-xl font-semibold text-balance">
        Boo. Your reading list is empty.
      </h1>
      <p
        className="mb-8 text-[var(--text-muted)] text-sm max-w-xs text-pretty"
        aria-live="polite"
        aria-atomic="true"
      >
        {loading ? 'Fetching curiousities…' : 'How about one of these?'}
      </p>

      <WikipediaArticleList loading={loading} articles={articles} />

      <Link
        to="/unread"
        className={`text-[var(--text-muted)] hover:text-[var(--text)] text-sm transition ${FOCUS_RING} rounded`}
      >
        ← Back to Linklater
      </Link>
    </div>
  );
}
