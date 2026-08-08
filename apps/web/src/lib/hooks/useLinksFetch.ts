import { fetchParametersReducer } from './useLinksData.reducer';
import { findNewLinks, mergeSettledMetadata } from './linksData.utils';
import { loadLinksPage } from './useLinksFetch.page';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { useTrailingItemAutoLoad } from './useLinksFetch.trailingItem';
import type { Dispatch, SetStateAction } from 'react';
import type { Link, PaginatedLinks } from '../api';
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
 * What is left here is the part that genuinely needs React: state, effect
 * lifetimes, and cancellation. Request shaping and the outcome the caller
 * applies live in `useLinksFetch.page`; the trailing-item decision, loop
 * guard included, lives in `useLinksFetch.trailingItem`.
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
    setFetchError(null);

    const load = async () => {
      const outcome = await loadLinksPage(fetchParameters);
      if (cancelled) return;

      if (outcome.status === 'failed') {
        setFetchError(outcome.message);
      } else {
        setLinks((previous) =>
          outcome.mode === 'merge'
            ? mergeSettledMetadata(outcome.data, previous)
            : [...previous, ...findNewLinks(outcome.data, previous)],
        );
        setPagination(outcome.pagination);
      }

      setLoadingLinks(false);
      hasSettledOnceReference.current = true;
      setHasSettledOnce(true);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [fetchParameters]);

  const handleLoadMore = useCallback(() => {
    dispatchFetchParameters({ type: 'load-more' });
  }, []);

  useTrailingItemAutoLoad(
    { loadingLinks, pagination, linkCount: links.length },
    handleLoadMore,
  );

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
