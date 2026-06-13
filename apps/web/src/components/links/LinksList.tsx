import IconButton from '../common/IconButton';
import LinkCard, { LinkCardSkeleton } from './LinkCard';
import SuggestionCallout from './SuggestionCallout';
import type { Link, PaginatedLinks } from '../../lib/api';
import type { LinksFilter } from '../../lib/hooks/useLinks';
import type { ReactNode } from 'react';

/**
 * Stable `id` for the links list region, referenced by the search input's
 * `aria-controls`.
 */
export const LINKS_LIST_ID = 'links-list';

/**
 * Props for `LinksList`. All data and callbacks are passed down from
 * `LinksView` via `useLinks`.
 */
interface LinksListProps {
  /** The current tab — determines the empty-state message and icon. */
  filter: LinksFilter;
  /**
   * `true` once the hook has settled at least one fetch. Gates the initial
   * skeleton so that subsequent search/filter re-fetches keep the stale list
   * mounted rather than flashing back to a skeleton between keystrokes.
   */
  hasSettledOnce: boolean;
  /**
   * When `true`, all cards play an exit animation (`animate-card-exit`)
   * to signal that the "delete all read" action is in progress.
   */
  isClearingRead: boolean;
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
  onReadToggle: (link: Link) => void;
  /** Called when the user clicks "Load more". */
  onLoadMore: () => void;
}

/**
 * Renders the paginated list of link cards. Handles three states:
 * - Initial loading (first ever fetch): single `LinkCardSkeleton`.
 * - Empty: contextual empty-state message (different for unread, read, and search).
 * - Populated: a grid of `LinkCard` components with a "Load more" button when
 *   additional pages exist.
 *
 * On re-fetches after the first settle the stale list (or empty state) stays
 * mounted; the loading affordance is AT-only via `aria-busy` on the tabpanel
 * container (WCAG 4.1.3 Status Messages), so sighted users do not see a
 * skeleton flash between keystrokes.
 *
 * The tabpanel container (`role="tabpanel"`, `aria-labelledby`, `aria-busy`)
 * is rendered once around every branch so that AT state never drops between
 * loading, empty, and populated transitions.
 *
 * Card animation delays are capped at 240ms (`Math.min(index * 60, 240)`) so
 * that large lists do not have an unacceptably long stagger.
 */
export default function LinksList({
  filter,
  hasSettledOnce,
  isClearingRead,
  links,
  loadingLinks,
  page,
  pagination,
  search,
  debouncedSearch,
  selectedLinkIndex,
  onReadToggle,
  onLoadMore,
}: LinksListProps) {
  const tabPanelLabelId = filter === 'read' ? 'tab-read' : 'tab-unread';
  const isInitialLoad = loadingLinks && page === 1 && !hasSettledOnce;

  // Show the discovery callout only when the unread list is genuinely
  // empty — never when an active search just happens to return no
  // matches, and never on the read tab.
  const isUnreadEmpty =
    filter === 'unread' && search === '' && debouncedSearch === '';

  let body: ReactNode;
  let containerClass: string;

  if (isInitialLoad) {
    containerClass = 'grid grid-cols-1 gap-6 mt-6';
    body = <LinkCardSkeleton />;
  } else if (links.length === 0) {
    containerClass =
      'flex flex-col items-center justify-center py-9 text-center animate-fade-in-up';
    body = (
      <>
        <i
          className={`text-4xl text-[var(--base-subtle-text)] mb-[7px] fa-solid ${
            search !== '' || debouncedSearch !== ''
              ? 'fa-magnifying-glass'
              : filter === 'read'
                ? 'fa-circle-check'
                : 'fa-bookmark'
          }`}
          aria-hidden="true"
        />
        <p className="mb-6 text-[var(--base-alt-text)] text-sm font-medium">
          {filter === 'read' ? 'No read links' : 'No unread links'}
        </p>
        {isUnreadEmpty && <SuggestionCallout inNewTab={true} />}
      </>
    );
  } else {
    containerClass = 'grid grid-cols-1 gap-6 mt-6 mb-28';
    body = (
      <>
        {links.map((link, index) => (
          <div
            key={link.id}
            className={
              isClearingRead ? 'animate-card-exit pointer-events-none' : ''
            }
            style={
              isClearingRead ? { animationDelay: `${index * 40}ms` } : undefined
            }
          >
            <LinkCard
              link={link}
              animationDelay={Math.min(index * 60, 240)}
              isSelected={selectedLinkIndex === index}
              onReadToggle={onReadToggle}
            />
          </div>
        ))}

        {loadingLinks && page > 1 && <LinkCardSkeleton />}

        {pagination &&
          // "Less doesn't need more": never offer a Load more button for a
          // single trailing item — `useLinksData` auto-loads that case so the
          // remaining link arrives without a click.
          pagination.total - links.length > 1 &&
          !loadingLinks && (
            <div className="flex justify-center pt-2">
              <IconButton
                variant="elevated"
                surface="base"
                onClick={onLoadMore}
              >
                {`Load more (${pagination.total - links.length} remaining)`}
              </IconButton>
            </div>
          )}
      </>
    );
  }

  return (
    <div
      id={LINKS_LIST_ID}
      role="tabpanel"
      aria-labelledby={tabPanelLabelId}
      aria-busy={loadingLinks}
      className={containerClass}
    >
      {body}
    </div>
  );
}
