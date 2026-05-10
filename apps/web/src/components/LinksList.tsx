import IconButton from './ui/IconButton';
import LinkCard, { LinkCardSkeleton } from './LinkCard';
import type { Link, PaginatedLinks } from '../lib/api';
import type { LinksFilter } from '../lib/useLinks';

/**
 * Props for `LinksList`. All data and callbacks are passed down from
 * `LinksView` via `useLinks`.
 */
interface LinksListProps {
  /** The active tab — determines the empty-state message and icon. */
  filter: LinksFilter;
  /**
   * When `true`, all cards play an exit animation (`animate-card-exit`)
   * to signal that the "delete all archived" action is in progress.
   */
  isClearingArchived: boolean;
  /** The links to render. */
  links: Link[];
  /** `true` while a fetch is in progress. */
  loadingLinks: boolean;
  /** The current page number (1-based). */
  page: number;
  /** Pagination metadata used to decide whether to show "Load more". */
  pagination: Pick<PaginatedLinks, 'total' | 'limit'> | null;
  /** Current search query — used to pick the right empty-state icon. */
  search: string;
  /** Debounced search query — used alongside `search` to avoid icon flicker during transition. */
  debouncedSearch: string;
  /** Index of the keyboard-selected link, or `null` if one isn't selected. */
  selectedLinkIndex: number | null;
  /** Passed through to each `LinkCard`. */
  onArchiveToggle: (link: Link) => void;
  /** Called when the user clicks "Load more". */
  onLoadMore: () => void;
}

/**
 * Renders the paginated list of link cards. Handles three states:
 * - Initial loading: single `LinkCardSkeleton`.
 * - Empty: contextual empty-state message (different for unread, archived, and search).
 * - Populated: a grid of `LinkCard` components with a "Load more" button when
 *   additional pages exist.
 *
 * Card animation delays are capped at 240ms (`Math.min(index * 60, 240)`) so
 * that large lists do not have an unacceptably long stagger.
 */
export default function LinksList({
  filter,
  isClearingArchived,
  links,
  loadingLinks,
  page,
  pagination,
  search,
  debouncedSearch,
  selectedLinkIndex,
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
            search !== '' || debouncedSearch !== ''
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
    <div className="mt-6 mb-28 grid grid-cols-1 gap-6">
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
            isSelected={selectedLinkIndex === index}
            onArchiveToggle={onArchiveToggle}
          />
        </div>
      ))}

      {loadingLinks && page > 1 && <LinkCardSkeleton />}

      {pagination && links.length < pagination.total && !loadingLinks && (
        <div className="flex justify-center pt-2">
          <IconButton variant="elevated" onClick={onLoadMore}>
            {`Load more (${pagination.total - links.length} remaining)`}
          </IconButton>
        </div>
      )}
    </div>
  );
}
