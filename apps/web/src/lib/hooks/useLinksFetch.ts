import { fetchParamsReducer } from './useLinksData.reducer';
import { getLinks, type Link, type PaginatedLinks } from '../api';
import { getErrorMessage } from '../errors';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { LinksFilter } from './types';

type Pagination = Pick<PaginatedLinks, 'total' | 'limit'> | null;

/** Fetch-driven state plus the setters the facade needs to mutate it. */
export interface UseLinksFetchResult {
  fetchError: string | null;
  handleLoadMore: () => void;
  hasSettledOnce: boolean;
  links: Link[];
  loadingLinks: boolean;
  page: number;
  pagination: Pagination;
  setLinks: Dispatch<SetStateAction<Link[]>>;
  setPagination: Dispatch<SetStateAction<Pagination>>;
}

/**
 * Owns the `GET /links` query lifecycle: the reducer-driven fetch effect,
 * pagination, the "less doesn't need more" load-more limit override, and the
 * page-1 auto-load safety net. Exposes `setLinks`/`setPagination` so the
 * facade can layer mutation helpers and the visibility refresh over the same
 * list state without a second source of truth.
 *
 * @param filter - `'unread'` or `'read'`.
 * @param search - Full-text search query, or empty string for no filter.
 */
export function useLinksFetch(
  filter: LinksFilter,
  search: string,
): UseLinksFetchResult {
  const [links, setLinks] = useState<Link[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<Pagination>(null);
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

  return {
    fetchError,
    handleLoadMore,
    hasSettledOnce,
    links,
    loadingLinks,
    page: fetchParams.page,
    pagination,
    setLinks,
    setPagination,
  };
}
