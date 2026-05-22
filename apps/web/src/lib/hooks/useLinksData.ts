import { getLinks, type Link, type PaginatedLinks } from '../api';
import { getErrorMessage } from '../errors';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type { LinksFilter } from './useLinks';

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
  /** Empties the links array in state. Used after "delete all read". */
  clearLinks: () => void;
  /** Error message from the most recent failed fetch, or `null` when the last fetch succeeded. */
  fetchError: string | null;
  /** Increments the page and triggers a fetch for the next batch. */
  handleLoadMore: () => void;
  /** The links currently loaded into state. */
  links: Link[];
  /** `true` during any in-flight fetch. */
  loadingLinks: boolean;
  /** The current page number (1-based). */
  page: number;
  /** Pagination metadata from the last successful response, or `null` before the first fetch. */
  pagination: Pick<PaginatedLinks, 'total' | 'limit'> | null;
  /**
   * Inserts `link` at the top of the list, deduplicating by id. Used for
   * optimistic prepend after a successful create.
   */
  prependLink: (link: Link) => void;
  /** Removes the link with the given id from state. */
  removeLink: (linkId: string) => void;
  /** Resets the cached total to zero without clearing the links array. */
  resetTotal: () => void;
  /** Replaces the in-state copy of a link with the updated version. */
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

    if (fetchParams.page === 1) setLinks([]);
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

  return {
    adjustTotal,
    clearLinks,
    fetchError,
    handleLoadMore,
    links,
    loadingLinks,
    page: fetchParams.page,
    pagination,
    prependLink,
    removeLink,
    resetTotal,
    updateLink,
  };
}
