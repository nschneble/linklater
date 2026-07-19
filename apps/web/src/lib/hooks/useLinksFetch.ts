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
 * pagination, and the "less doesn't need more" auto-load net that pulls a
 * lone trailing item as its own follow-up page. Exposes
 * `setLinks`/`setPagination` so the facade can layer mutation helpers and
 * the visibility refresh over the same list state without a second source
 * of truth.
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

  const handleLoadMore = useCallback(() => {
    dispatchFetchParams({ type: 'load-more' });
  }, []);

  // The sole mechanism for the "less doesn't need more" rule. Rather than
  // varying the page limit to grab a trailing item early, which would
  // desync the server's `(page - 1) * limit` offset and skip a row, we
  // keep the limit constant and load the lone trailing item as its own
  // next page. After any fetch settles, if exactly one item remains
  // unloaded, auto-load it so the user never has to click a
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
