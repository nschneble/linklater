import type { Link, PaginatedLinks } from '../api';

/**
 * Everything `useLinksData` exposes. The mutation helpers
 * (`prependLink`, `updateLink`, `removeLink`, etc.) let sibling hooks
 * (`useLinksActions`) keep the rendered list in sync with server
 * operations without a full refetch.
 */
export interface UseLinksDataResult {
  /**
   * Nudges the cached `total` count by `delta`. Positive to increment,
   * negative to decrement. Used after create/update/delete to keep the
   * count accurate without a round-trip.
   */
  adjustTotal: (delta: number) => void;
  // used after "delete all read"
  clearLinks: () => void;
  fetchError: string | null;
  handleLoadMore: () => void;
  /**
   * `true` after the very first fetch has settled (success or failure). Used
   * by the view layer to keep stale content in place on subsequent
   * filter/search re-fetches: once the user has seen real content, we keep
   * the stale list mounted until the new response arrives instead of clearing
   * it back to blank on every keystroke. It also gates the empty-state message
   * so that message never flashes before the first fetch has settled.
   */
  hasSettledOnce: boolean;
  links: Link[];
  loadingLinks: boolean;
  /**
   * Polite live-region message describing links that arrived via a
   * background visibility refresh (e.g. saved via the bookmarklet on
   * another tab). Empty string when there is nothing to announce.
   */
  newLinksAnnouncement: string;
  // 1-based
  page: number;
  // null before the first fetch
  pagination: Pick<PaginatedLinks, 'total' | 'limit'> | null;
  /**
   * Inserts `link` at the top of the list, deduplicating by id. Used for
   * optimistic prepend after a successful create.
   */
  prependLink: (link: Link) => void;
  removeLink: (linkId: string) => void;
  // resets the cached total to zero without clearing the links array
  resetTotal: () => void;
  /**
   * Replaces the matching cached entry in local state. Not the same as the
   * API-layer `refreshLink` – this mutates the in-memory list only and never
   * round-trips to the server.
   */
  updateLink: (link: Link) => void;
}
