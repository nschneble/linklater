import { getLinks, type Link, type PaginatedLinks } from '../api';
import { getErrorMessage } from '../errors';
import { findNewLinks } from './linksData.utils';
import { useLinksVisibilityRefresh } from './useLinksVisibilityRefresh';
import type { LinksFilter } from './types';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';

/**
 * Internal state driving the `GET /links` query. Held in a reducer so that
 * filter/search changes & load-more increments can be handled atomically.
 */
interface FetchParams {
  /** The current tab — `'unread'` or `'read'`. */
  filter: LinksFilter;
  /** The current pagination page number, starting at 1. */
  page: number;
  /** The full-text search query string, or an empty string when not searching. */
  search: string;
  /**
   * One-shot limit override for the next fetch. Used by the "less doesn't
   * need more" rule: when the next page would leave exactly one trailing
   * item, the override grabs that item in the same request rather than
   * forcing a follow-up.
   */
  limit?: number;
}

type FetchParamsAction =
  | { type: 'reset'; filter: LinksFilter; search: string }
  | { type: 'load-more'; limit?: number };

/**
 * Pure reducer for `FetchParams`. `'reset'` replaces filter/search and
 * resets the page to 1, but is a no-op when filter and search haven't
 * changed to avoid redundant fetches. `'load-more'` increments the page #
 * and optionally carries a one-shot limit override for that page.
 */
export function fetchParamsReducer(
  state: FetchParams,
  action: FetchParamsAction,
): FetchParams {
  switch (action.type) {
    case 'reset':
      if (state.filter === action.filter && state.search === action.search) {
        return state;
      }
      return { filter: action.filter, page: 1, search: action.search };
    case 'load-more':
      return { ...state, page: state.page + 1, limit: action.limit };
  }
}

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
   * by the view layer to suppress the skeleton flash on subsequent
   * filter/search re-fetches — once the user has seen real content, we keep
   * the stale list mounted until the new response arrives instead of clearing
   * back to a skeleton on every keystroke.
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
   * API-layer `refreshLink` — this mutates the in-memory list only and never
   * round-trips to the server.
   */
  updateLink: (link: Link) => void;
}

/**
 * Manages fetching, paginating, and locally mutating the links list.
 *
 * Internally drives a `useReducer` for fetch parameters so that filter and
 * search transitions and load-more increments are always applied
 * atomically. Each time `fetchParams` changes a new `GET /links` request
 * is issued. A stale-request guard (`cancelled` flag) prevents
 * out-of-order responses from corrupting state.
 *
 * @param filter - `'unread'` or `'read'`.
 * @param search - Full-text search query, or empty string for no filter.
 *
 * @returns Data state and mutation helpers consumed by `useLinksActions`
 *          and the view layer.
 */
export function useLinksData(
  filter: LinksFilter,
  search: string,
): UseLinksDataResult {
  const [links, setLinks] = useState<Link[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<Pick<
    PaginatedLinks,
    'total' | 'limit'
  > | null>(null);
  const [hasSettledOnce, setHasSettledOnce] = useState(false);

  // Ref-mirror of `hasSettledOnce` so the fetch effect can branch on its
  // latest value without re-running on every settle. Reading state directly
  // inside the effect would either be stale (closed over an old value) or
  // require adding `hasSettledOnce` to the dep array, which would re-fire the
  // fetch on first settle and produce an unwanted double-request.
  const hasSettledOnceReference = useRef(false);

  const [fetchParams, dispatchFetchParams] = useReducer(fetchParamsReducer, {
    filter,
    page: 1,
    search,
  });

  useEffect(() => {
    dispatchFetchParams({ type: 'reset', filter, search });
  }, [filter, search]);

  useEffect(() => {
    let cancelled = false;

    // Only blank the list on the very first page-1 fetch. After the user has
    // seen real content once, keep the stale list mounted across re-fetches
    // so search/filter changes don't flash a skeleton between keystrokes.
    // `setLinks(result.data)` below still overwrites the list on settle, so
    // an empty result still transitions to the empty state.
    if (fetchParams.page === 1 && !hasSettledOnceReference.current) {
      setLinks([]);
    }
    setLoadingLinks(true);

    const load = async () => {
      setFetchError(null);
      try {
        const result = await getLinks({
          search: fetchParams.search || undefined,
          read: fetchParams.filter === 'read',
          page: fetchParams.page,
          limit: fetchParams.limit,
        });
        if (!cancelled) {
          if (fetchParams.page === 1) {
            setLinks(result.data);
          } else {
            setLinks((previous) => [...previous, ...result.data]);
          }
          setPagination({ total: result.total, limit: result.limit });
        }
      } catch (error) {
        if (!cancelled) {
          setFetchError(getErrorMessage(error, 'Failed to load links'));
        }
      } finally {
        if (!cancelled) {
          setLoadingLinks(false);
          hasSettledOnceReference.current = true;
          setHasSettledOnce(true);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [fetchParams]);

  // Refs so `handleLoadMore` and the auto-load effect can read the latest
  // counts without having to be recreated on every state change.
  const linksLengthRef = useRef(links.length);
  const paginationRef = useRef(pagination);
  linksLengthRef.current = links.length;
  paginationRef.current = pagination;

  /**
   * Computes the optional limit override used to honor the
   * "less doesn't need more" rule: if the next page at its normal size
   * would leave exactly one trailing item, request one extra so the
   * trailing item ships in the same response instead of stranding a
   * "Load more (1 remaining)" button.
   */
  const computeLoadMoreLimit = useCallback((): number | undefined => {
    const currentPagination = paginationRef.current;
    if (!currentPagination) return undefined;
    const loaded = linksLengthRef.current;
    const remainingAfterNext =
      currentPagination.total - (loaded + currentPagination.limit);
    if (remainingAfterNext === 1) {
      return currentPagination.limit + 1;
    }
    return undefined;
  }, []);

  const handleLoadMore = useCallback(() => {
    dispatchFetchParams({
      type: 'load-more',
      limit: computeLoadMoreLimit(),
    });
  }, [computeLoadMoreLimit]);

  // Safety net for the "less doesn't need more" rule on page 1, where we
  // don't know the total beforehand. After any fetch settles, if exactly
  // one trailing item remains, auto-load it so the user never sees a
  // "Load more (1 remaining)" button. Guarded by a "last-fired" key so that
  // a server returning fewer items than its own `total` cannot pull us into
  // a refetch loop.
  const lastAutoFireKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (loadingLinks) return;
    if (!pagination) return;
    if (links.length === 0) return;
    const remaining = pagination.total - links.length;
    if (remaining !== 1) return;
    const key = `${links.length}:${pagination.total}`;
    if (lastAutoFireKeyRef.current === key) return;
    lastAutoFireKeyRef.current = key;
    dispatchFetchParams({ type: 'load-more' });
  }, [loadingLinks, pagination, links.length]);

  const prependLink = useCallback((link: Link) => {
    // Deduplicate by id in case the link was already in the list, e.g.
    // from a polling update that arrived before the create callback ran.
    setLinks((previous) => [
      link,
      ...previous.filter((item) => item.id !== link.id),
    ]);
  }, []);

  const updateLink = useCallback((link: Link) => {
    setLinks((previous) =>
      previous.map((item) => (item.id === link.id ? link : item)),
    );
  }, []);

  const removeLink = useCallback((linkId: string) => {
    setLinks((previous) => previous.filter((item) => item.id !== linkId));
  }, []);

  const clearLinks = useCallback(() => {
    setLinks([]);
  }, []);

  const adjustTotal = useCallback((delta: number) => {
    setPagination((previous) =>
      previous ? { ...previous, total: previous.total + delta } : previous,
    );
  }, []);

  const resetTotal = useCallback(() => {
    setPagination((previous) =>
      previous ? { ...previous, total: 0 } : previous,
    );
  }, []);

  // Soft refresh on tab return. When the user saves a link via the
  // bookmarklet on another tab and switches back, we want the unread list
  // to surface the new link without a manual reload. Scoped to the default
  // unread, no-search view: paginated/searched/read views fall outside the
  // bookmarklet flow and refresh on the next deliberate user action.
  //
  // Existing items keep their positions and React keys (LinksList keys
  // by `link.id`), so focus inside a card is preserved across the refresh.
  // Newly-arrived items are announced via a polite live region rendered
  // by LinksView so screen-reader users learn that the list updated.
  const linksReference = useRef(links);
  linksReference.current = links;

  const handleVisibilityRefreshed = useCallback(
    (additions: Link[], result: { total: number; limit: number }) => {
      if (additions.length > 0) {
        // Deduplicate against the latest state inside the updater to guard
        // against races where a concurrent update already prepended some items.
        setLinks((previous) => [
          ...findNewLinks(additions, previous),
          ...previous,
        ]);
      }
      setPagination({ total: result.total, limit: result.limit });
    },
    [],
  );

  const newLinksAnnouncement = useLinksVisibilityRefresh({
    enabled: filter === 'unread' && search === '',
    linksReference,
    paginationReference: paginationRef,
    onRefreshed: handleVisibilityRefreshed,
  });

  return {
    adjustTotal,
    clearLinks,
    fetchError,
    handleLoadMore,
    hasSettledOnce,
    links,
    loadingLinks,
    newLinksAnnouncement,
    page: fetchParams.page,
    pagination,
    prependLink,
    removeLink,
    resetTotal,
    updateLink,
  };
}
