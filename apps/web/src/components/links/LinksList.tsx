import IconButton from '../common/IconButton';
import LinkCard from './LinkCard';
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
   * `true` once the hook has settled at least one fetch. Gates the empty-state
   * message so it never flashes before the first fetch settles, and lets
   * subsequent search/filter re-fetches keep the stale list mounted rather
   * than blanking back to the empty state between keystrokes.
   */
  hasSettledOnce: boolean;
  /**
   * When `true`, marks the tabpanel root inert so the list is excluded from tab
   * order and the accessibility tree while the inline "Save a link" dialog is
   * open (WCAG 2.4.3 Focus Order).
   */
  inert?: boolean;
  /**
   * When `true`, all cards play an exit animation (`animate-card-exit`)
   * to signal that the "delete all read" action is in progress.
   */
  isClearingRead: boolean;
  /** The links to render. */
  links: Link[];
  /** `true` while a fetch is in progress. */
  loadingLinks: boolean;
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
 * - Loading with no content yet: nothing is drawn for sighted users (links
 *   arrive fast enough that a placeholder reads as a distracting flash), but a
 *   visually hidden `role="status"` paragraph announces "Loading links…" to
 *   screen readers (WCAG 4.1.3 Status Messages) so the load is not silent.
 *   This branch covers the first page-1 load and any re-fetch over an
 *   already-empty list, so the empty message never flashes mid-load.
 * - Populated: a grid of `LinkCard` components with a "Load more" button when
 *   additional pages exist.
 *
 * On re-fetches after the first settle a populated list stays mounted; the
 * loading affordance is AT-only via `aria-busy` on the tabpanel container
 * (WCAG 4.1.3 Status Messages), so sighted users see the stale content stay in
 * place rather than a placeholder flashing between keystrokes. An empty list is
 * the exception: an in-flight fetch shows the visually hidden loading status
 * rather than leaving stale empty text.
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
  inert,
  isClearingRead,
  links,
  loadingLinks,
  pagination,
  search,
  debouncedSearch,
  selectedLinkIndex,
  onReadToggle,
  onLoadMore,
}: LinksListProps) {
  const tabPanelLabelId = filter === 'read' ? 'tab-read' : 'tab-unread';

  // gated so the empty message never flashes before the first settle
  const showEmptyState = hasSettledOnce && !loadingLinks && links.length === 0;

  // callout only on a genuinely empty unread list, not a search miss
  const isUnreadEmpty =
    filter === 'unread' && search === '' && debouncedSearch === '';

  // aria-disabled doesn't block clicks, so guard against a double dispatch
  function handleLoadMore() {
    if (loadingLinks) {
      return;
    }
    onLoadMore();
  }

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
    // draw nothing to avoid a flash; sr-only announces load (WCAG 4.1.3)
    containerClass = '';
    body = (
      <p role="status" className="sr-only">
        Loading links…
      </p>
    );
  } else {
    // cards form a semantic list one level down (WCAG 1.3.1)
    containerClass = 'grid gap-6 mt-6 mb-28';
    body = (
      <>
        <div role="list" className="grid grid-cols-1 gap-6">
          {links.map((link, index) => (
            <div
              key={link.id}
              role="listitem"
              // min-w-0 stops unbreakable text overflowing (WCAG 1.4.10)
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

        {pagination &&
          // > 1: a lone trailing item is auto-loaded, so no "Load more"
          pagination.total - links.length > 1 && (
            <div className="flex justify-center pt-2">
              {/*
                keep the button mounted through its fetch; unmounting
                mid-fetch drops keyboard focus to <body> (WCAG 2.4.3)
              */}
              <IconButton
                variant="elevated"
                surface="base"
                className="aria-disabled:cursor-not-allowed"
                onClick={handleLoadMore}
                aria-busy={loadingLinks}
                aria-disabled={loadingLinks}
              >
                {loadingLinks
                  ? 'Loading…'
                  : `Load more (${pagination.total - links.length} remaining)`}
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
      inert={inert}
      className={containerClass}
    >
      {body}
    </div>
  );
}
