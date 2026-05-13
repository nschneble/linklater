import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchRandomWikipediaArticle } from '../../lib/wikipedia';
import type { WikipediaArticle } from '../../lib/wikipedia';
import PixelArtGhost from './PixelArtGhost';
import PrimaryButton from '../common/PrimaryButton';
import WikipediaArticleList from './WikipediaArticleList';

/**
 * Full-page empty state shown by `StumblePage` when the user has no unread
 * links. Displays a pixel-art ghost, a playful message, and three randomly
 * fetched Wikipedia article snippets as consolation reading.
 *
 * Wikipedia fetch failures are swallowed silently. The page degrades
 * gracefully to a static fallback message.
 */
export default function StumbleEmptyView() {
  const navigate = useNavigate();
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
        {loading ? 'Fetching entries…' : 'How about one of these?'}
      </p>

      <WikipediaArticleList loading={loading} articles={articles} />

      <PrimaryButton type="button" onClick={() => navigate('/unread')}>
        <i className="fa-solid fa-arrow-left text-xs" aria-hidden="true" />
        Back to Linklater
      </PrimaryButton>
    </div>
  );
}
