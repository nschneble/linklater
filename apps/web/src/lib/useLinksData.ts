import { getLinks, type Link, type PaginatedLinks } from './api';
import { useCallback, useEffect, useReducer, useState } from 'react';
import type { LinksFilter } from './useLinks';

interface FetchParams {
  filter: LinksFilter;
  page: number;
  search: string;
}

type FetchParamsAction =
  | { type: 'reset'; filter: LinksFilter; search: string }
  | { type: 'load-more' };

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
      return { ...state, page: state.page + 1 };
  }
}

export interface UseLinksDataResult {
  handleLoadMore: () => void;
  links: Link[];
  loadingLinks: boolean;
  page: number;
  pagination: Pick<PaginatedLinks, 'total' | 'limit'> | null;
  setLinks: React.Dispatch<React.SetStateAction<Link[]>>;
  setPagination: React.Dispatch<
    React.SetStateAction<Pick<PaginatedLinks, 'total' | 'limit'> | null>
  >;
}

export function useLinksData(
  filter: LinksFilter,
  search: string,
): UseLinksDataResult {
  const [links, setLinks] = useState<Link[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(true);
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
      try {
        const result = await getLinks({
          search: fetchParams.search || undefined,
          archived: fetchParams.filter === 'archived',
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
        console.error('Failed to load links', error);
      } finally {
        if (!cancelled) {
          setLoadingLinks(false);
        }
      }
    };

    const timeout = setTimeout(load, 200);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [fetchParams]);

  const handleLoadMore = useCallback(() => {
    dispatchFetchParams({ type: 'load-more' });
  }, []);

  return {
    handleLoadMore,
    links,
    loadingLinks,
    page: fetchParams.page,
    pagination,
    setLinks,
    setPagination,
  };
}
