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
  /** The current tab – determines the empty-state message and icon. */
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
  /** Current search query – used to pick the right empty-state icon. */
  search: string;
  /** Debounced search query – used alongside `search` to avoid icon flicker during transition. */
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
 * - Empty: contextual empty-state message (different for unread, read, and
 *   search), shown only once a fetch has settled with no items.
 * - Skeleton: a single `LinkCardSkeleton`, shown whenever the list is empty
 *   and a fetch is in flight (no settled items yet, or a re-fetch over an
 *   already-empty list) so the empty message never flashes mid-load.
 * - Populated: a grid of `LinkCard` components with a "Load more" button when
 *   additional pages exist.
 *
 * On re-fetches after the first settle a populated list stays mounted; the
 * loading affordance is AT-only via `aria-busy` on the tabpanel container
 * (WCAG 4.1.3 Status Messages), so sighted users do not see a skeleton flash
 * between keystrokes. An empty list is the exception: an in-flight fetch swaps
 * the empty state out for the skeleton rather than leaving stale empty text.
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

  // The empty-state message may only show once the hook has genuinely settled
  // with no items and no fetch in flight. While a load is in flight the list
  // can be blanked to `[]` (the first page-1 fetch) or already be empty from a
  // prior settle; in those windows the skeleton is the AT-correct in-load
  // state, so the empty text never flashes before real links render.
  const showEmptyState = hasSettledOnce && !loadingLinks && links.length === 0;

  // Show the discovery callout only when the unread list is genuinely
  // empty – never when an active search just happens to return no
  // matches, and never on the read tab.
  const isUnreadEmpty =
    filter === 'unread' && search === '' && debouncedSearch === '';

  let body: ReactNode;
  let containerClass: string;

  if (showEmptyState) {
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
  } else if (links.length === 0) {
    // Empty list with a fetch in flight (first page-1 load or a re-fetch over
    // an already-empty list). See the `showEmptyState` gate above for why this
    // renders the skeleton rather than the empty message.
    containerClass = 'grid grid-cols-1 gap-6 mt-6';
    body = <LinkCardSkeleton />;
  } else {
    // The tabpanel container itself carries only spacing; the cards form a
    // semantic list one level down (WCAG 1.3.1). The container stays a
    // single-column grid so the list, the load-more skeleton, and the "Load
    // more" button keep their uniform `gap-6` rhythm.
    containerClass = 'grid gap-6 mt-6 mb-28';
    body = (
      <>
        {/*
          A tabpanel cannot double as the list, so the cards live in a child
          `role="list"`. Each map wrapper is a `role="listitem"`. The skeleton
          and "Load more" button below are deliberately outside the list.
        */}
        <div role="list" className="grid grid-cols-1 gap-6">
          {links.map((link, index) => (
            <div
              key={link.id}
              role="listitem"
              // `min-w-0` resets the grid item's default `min-width: auto` to 0
              // so a long unbreakable title/URL cannot inflate the track past the
              // viewport (WCAG 1.4.10 Reflow). The card itself stays
              // `overflow-visible` so its favicon can straddle the left border.
              className={`min-w-0 ${
                isClearingRead ? 'animate-card-exit pointer-events-none' : ''
              }`}
              style={
                isClearingRead
                  ? { animationDelay: `${index * 40}ms` }
                  : undefined
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
        </div>

        {loadingLinks && page > 1 && <LinkCardSkeleton />}

        {pagination &&
          // "Less doesn't need more": never offer a Load more button for a
          // single trailing item – `useLinksData` auto-loads that case so the
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
