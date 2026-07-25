import { findNewLinks } from './linksData.utils';
import { useCallback, useRef } from 'react';
import { useLinksFetch } from './useLinksFetch';
import { useLinksMutations } from './useLinksMutations';
import { useLinksVisibilityRefresh } from './useLinksVisibilityRefresh';
import type { Link } from '../api';
import type { LinksFilter } from './types';
import type { UseLinksDataResult } from './useLinksData.types';

export { fetchParametersReducer } from './useLinksData.reducer';
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
  const paginationReference = useRef(pagination);
  paginationReference.current = pagination;

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
