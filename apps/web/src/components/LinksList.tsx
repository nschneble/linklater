import IconButton from './ui/IconButton';
import LinkCard, { LinkCardSkeleton } from './LinkCard';
import type { Link, PaginatedLinks } from '../lib/api';
import type { LinksFilter } from '../lib/useLinks';

interface LinksListProps {
  filter: LinksFilter;
  isClearingArchived: boolean;
  links: Link[];
  loadingLinks: boolean;
  page: number;
  pagination: Pick<PaginatedLinks, 'total' | 'limit'> | null;
  search: string;
  onArchiveToggle: (link: Link) => void;
  onLoadMore: () => void;
}

export default function LinksList({
  filter,
  isClearingArchived,
  links,
  loadingLinks,
  page,
  pagination,
  search,
  onArchiveToggle,
  onLoadMore,
}: LinksListProps) {
  if (loadingLinks && page === 1) {
    return (
      <div className="mt-6 grid grid-cols-1 gap-6">
        <LinkCardSkeleton />
      </div>
    );
  }

  if (links.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-9 text-center animate-fade-in-up">
        <i
          className={`text-4xl text-[var(--text-subtle)] mb-[7px] fa-regular ${
            search !== ''
              ? 'fa-magnifying-glass'
              : filter === 'archived'
                ? 'fa-circle-check'
                : 'fa-bookmark'
          }`}
          aria-hidden="true"
        />
        <p className="text-[var(--text-muted)] text-sm font-medium">
          {filter === 'archived' ? 'No read links' : 'No unread links'}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 grid grid-cols-1 gap-6">
      {links.map((link, index) => (
        <div
          key={link.id}
          className={
            isClearingArchived ? 'animate-card-exit pointer-events-none' : ''
          }
          style={
            isClearingArchived
              ? { animationDelay: `${index * 40}ms` }
              : undefined
          }
        >
          <LinkCard
            link={link}
            animationDelay={Math.min(index * 60, 240)}
            onArchiveToggle={() => onArchiveToggle(link)}
          />
        </div>
      ))}

      {pagination && links.length < pagination.total && (
        <div className="flex justify-center pt-2">
          <IconButton
            variant="elevated"
            disabled={loadingLinks}
            onClick={onLoadMore}
          >
            {loadingLinks
              ? 'Loading…'
              : `Load more (${pagination.total - links.length} remaining)`}
          </IconButton>
        </div>
      )}
    </div>
  );
}
