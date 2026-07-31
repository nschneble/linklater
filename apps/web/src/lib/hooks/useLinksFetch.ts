import { fetchParametersReducer } from './useLinksData.reducer';
import { getLinks, type Link, type PaginatedLinks } from '../api';
import { getErrorMessage } from '../errors';
import { findNewLinks, mergeSettledMetadata } from './linksData.utils';
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
 * On a page-1 settle the response is merged over the current list via
 * `mergeSettledMetadata` rather than replacing it outright: incoming still
 * wins ordering, membership, and every other field, but stale null metadata
 * cannot overwrite a card the client already settled, so a search/filter
 * refetch never reverts a settled card to its loading skeleton.
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

  // ref-mirror of `hasSettledOnce`; a dep-array entry would double-fire on first settle
  const hasSettledOnceReference = useRef(false);

  const [fetchParameters, dispatchFetchParameters] = useReducer(
    fetchParametersReducer,
    {
      filter,
      page: 1,
      search,
    },
  );

  useEffect(() => {
    dispatchFetchParameters({ type: 'reset', filter, search });
  }, [filter, search]);

  useEffect(() => {
    let cancelled = false;

    // blank only on the first page-1 fetch; keep the stale list so keystrokes don't flash blank
    if (fetchParameters.page === 1 && !hasSettledOnceReference.current) {
      setLinks([]);
    }
    setLoadingLinks(true);

    const load = async () => {
      setFetchError(null);
      try {
        const result = await getLinks({
          search: fetchParameters.search || undefined,
          read: fetchParameters.filter === 'read',
          page: fetchParameters.page,
        });
        if (!cancelled) {
          if (fetchParameters.page === 1) {
            setLinks((previous) => mergeSettledMetadata(result.data, previous));
          } else {
            // append only new rows: a prepend shifts the offset, so a later page can re-serve an on-screen row
            setLinks((previous) => [
              ...previous,
              ...findNewLinks(result.data, previous),
            ]);
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
  }, [fetchParameters]);

  const handleLoadMore = useCallback(() => {
    dispatchFetchParameters({ type: 'load-more' });
  }, []);

  // "less doesn't need more": auto-load a lone trailing item as its own page; last-fired key stops a refetch loop
  const lastAutoFireKeyReference = useRef<string | null>(null);
  useEffect(() => {
    if (loadingLinks) return;
    if (!pagination) return;
    if (links.length === 0) return;
    const remaining = pagination.total - links.length;
    if (remaining !== 1) return;
    const key = `${links.length}:${pagination.total}`;
    if (lastAutoFireKeyReference.current === key) return;
    lastAutoFireKeyReference.current = key;
    dispatchFetchParameters({ type: 'load-more' });
  }, [loadingLinks, pagination, links.length]);

  return {
    fetchError,
    handleLoadMore,
    hasSettledOnce,
    links,
    loadingLinks,
    page: fetchParameters.page,
    pagination,
    setLinks,
    setPagination,
  };
}
