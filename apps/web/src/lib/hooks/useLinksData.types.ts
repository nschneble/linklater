import type { Link, PaginatedLinks } from '../api';

export interface UseLinksDataResult {
  adjustTotal: (delta: number) => void;
  clearLinks: () => void;
  fetchError: string | null;
  handleLoadMore: () => void;
  /**
   * True once the first fetch has settled. Lets the view hold stale
   * content through later re-fetches instead of blanking on every
   * keystroke, and keeps the empty state from flashing before then.
   */
  hasSettledOnce: boolean;
  links: Link[];
  loadingLinks: boolean;
  /** Announces links that arrived on a background visibility refresh. */
  newLinksAnnouncement: string;
  // 1-based
  page: number;
  // null before the first fetch
  pagination: Pick<PaginatedLinks, 'total' | 'limit'> | null;
  /** Inserts at the top of the list, deduplicating by id. */
  prependLink: (link: Link) => void;
  removeLink: (linkId: string) => void;
  // zeroes the total without touching the links array
  resetTotal: () => void;
  /** Local-only: replaces the cached entry with no server round-trip. */
  updateLink: (link: Link) => void;
}
