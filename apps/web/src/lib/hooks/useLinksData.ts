import { findNewLinks } from './linksData.utils';
import { useCallback, useRef } from 'react';
import { useLinksFetch } from './useLinksFetch';
import { useLinksMutations } from './useLinksMutations';
import { useLinksVisibilityRefresh } from './useLinksVisibilityRefresh';
import { usePendingMetadataPolling } from './usePendingMetadataPolling';
import type { Link } from '../api';
import type { LinksFilter } from './types';
import type { UseLinksDataResult } from './useLinksData.types';

export type { UseLinksDataResult } from './useLinksData.types';

/**
 * Manages fetching, paginating, and locally mutating the links list.
 *
 * Composes three focused concerns: `useLinksFetch` owns the `GET /links`
 * query lifecycle and pagination, `useLinksMutations` provides the in-memory
 * list/count helpers, and `useLinksVisibilityRefresh` soft-refreshes the
 * unread list on tab return. This facade wires them over a single shared
 * list/pagination state and re-exposes a stable API.
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
  const {
    fetchError,
    handleLoadMore,
    hasSettledOnce,
    links,
    loadingLinks,
    page,
    pagination,
    setLinks,
    setPagination,
  } = useLinksFetch(filter, search);

  const {
    adjustTotal,
    clearLinks,
    prependLink,
    removeLink,
    resetTotal,
    updateLink,
  } = useLinksMutations({ setLinks, setPagination });

  // poll pending metadata; deriving from list state covers every arrival route
  usePendingMetadataPolling(links, updateLink);

  // soft-refresh unread on tab return to catch a bookmarklet save elsewhere
  const linksReference = useRef(links);
  linksReference.current = links;
  const paginationReference = useRef(pagination);
  paginationReference.current = pagination;

  const handleVisibilityRefreshed = useCallback(
    (additions: Link[], result: { total: number; limit: number }) => {
      if (additions.length > 0) {
        // dedupe inside the updater to guard against a concurrent prepend race
        setLinks((previous) => [
          ...findNewLinks(additions, previous),
          ...previous,
        ]);
      }
      setPagination({ total: result.total, limit: result.limit });
    },
    [setLinks, setPagination],
  );

  const newLinksAnnouncement = useLinksVisibilityRefresh({
    enabled: filter === 'unread' && search === '',
    linksReference,
    paginationReference,
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
    page,
    pagination,
    prependLink,
    removeLink,
    resetTotal,
    updateLink,
  };
}
