import LinkCard, { LinkCardSkeleton } from '../links/LinkCard';
import { articleToLink } from '../../lib/wikipedia';
import type { WikipediaArticle } from '../../lib/wikipedia';

interface WikipediaArticleListProps {
  loading: boolean;
  articles: WikipediaArticle[];
}

export default function WikipediaArticleList({
  loading,
  articles,
}: WikipediaArticleListProps) {
  function renderItems() {
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
    <ul
      className="w-full max-w-md space-y-3 text-left mb-10"
      aria-label="Suggested reading from Wikipedia"
    >
      {renderItems()}
    </ul>
  );
}
