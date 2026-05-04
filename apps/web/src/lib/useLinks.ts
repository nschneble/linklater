import {
  archiveLink,
  createLink,
  deleteAllArchivedLinks,
  getLinks,
  unarchiveLink,
  type Link,
  type PaginatedLinks,
} from './api';

import { getErrorMessage } from './errors';
import { useCallback, useEffect, useReducer, useState } from 'react';
import { useMetadataPolling } from './useMetadataPolling';
import { usePasteDetection } from './usePasteDetection';
import { useRandomLink } from './useRandomLink';

type LinksFilter = 'active' | 'archived';

interface FetchParams {
  filter: LinksFilter;
  page: number;
  search: string;
}

type FetchParamsAction =
  | { type: 'reset'; filter: LinksFilter; search: string }
  | { type: 'load-more' };

function fetchParamsReducer(
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

export interface UseLinksResult {
  handleCreated: (link: Link) => void;
  handleDeleteAllArchived: () => Promise<void>;
  handleDismissToast: () => void;
  handleLoadMore: () => void;
  handleRandom: () => Promise<void>;
  handleToggleArchive: (link: Link) => Promise<void>;
  handleToggleForm: () => void;
  links: Link[];
  loadingLinks: boolean;
  page: number;
  pagination: Pick<PaginatedLinks, 'total' | 'limit'> | null;
  randomError: string | null;
  randomLoading: boolean;
  saveError: string | null;
  showLinkForm: boolean;
  toastMessage: string | null;
}

export function useLinks(filter: LinksFilter, search: string): UseLinksResult {
  const [links, setLinks] = useState<Link[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(true);
  const [pagination, setPagination] = useState<Pick<
    PaginatedLinks,
    'total' | 'limit'
  > | null>(null);
  const [pendingMetaLinkId, setPendingMetaLinkId] = useState<string | null>(
    null,
  );
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [fetchParams, dispatchFetchParams] = useReducer(fetchParamsReducer, {
    filter,
    page: 1,
    search,
  });

  useMetadataPolling(pendingMetaLinkId, (updatedLink) => {
    setLinks((previous) =>
      previous.map((link) => (link.id === updatedLink.id ? updatedLink : link)),
    );
    setPendingMetaLinkId(null);
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

  const handleCreated = useCallback(
    (link: Link) => {
      if (filter === 'archived') {
        setShowLinkForm(false);
        return;
      }
      setLinks((previous) => {
        const isNew = !previous.some((item) => item.id === link.id);
        if (isNew) {
          setPagination((previous) =>
            previous ? { ...previous, total: previous.total + 1 } : previous,
          );
        }
        return [link, ...previous.filter((item) => item.id !== link.id)];
      });
      setShowLinkForm(false);
      setPendingMetaLinkId(link.id);
      setToastMessage('Link saved!');
    },
    [filter],
  );

  const handleDirectSave = useCallback(
    async (url: string) => {
      setSaveError(null);
      try {
        const link = await createLink({ url });
        handleCreated(link);
      } catch (error: unknown) {
        setSaveError(getErrorMessage(error, 'Failed to save link'));
      }
    },
    [handleCreated],
  );

  usePasteDetection({ onSave: handleDirectSave });

  const handleToggleArchive = useCallback(
    async (link: Link) => {
      try {
        const updated = link.archivedAt
          ? await unarchiveLink(link.id)
          : await archiveLink(link.id);

        setLinks((previous) => {
          const isFilteredOut =
            (filter === 'active' && updated.archivedAt) ||
            (filter === 'archived' && !updated.archivedAt);

          if (isFilteredOut) {
            setPagination((previous) =>
              previous ? { ...previous, total: previous.total - 1 } : previous,
            );
            return previous.filter((item) => item.id !== updated.id);
          }

          return previous.map((item) =>
            item.id === updated.id ? updated : item,
          );
        });
      } catch (error: unknown) {
        console.error('Failed to toggle archive state', error);
      }
    },
    [filter],
  );

  const handleDeleteAllArchived = useCallback(async () => {
    try {
      await deleteAllArchivedLinks();
      setLinks([]);
      setPagination((previous) =>
        previous ? { ...previous, total: 0 } : previous,
      );
    } catch (error: unknown) {
      console.error('Failed to delete all archived links', error);
    }
  }, []);

  const handleRemoveLink = useCallback((linkId: string) => {
    setLinks((previous) => previous.filter((link) => link.id !== linkId));
  }, []);

  const handleDecrementTotal = useCallback(() => {
    setPagination((previous) =>
      previous ? { ...previous, total: previous.total - 1 } : previous,
    );
  }, []);

  const { handleRandom, randomError, randomLoading } = useRandomLink({
    filter,
    onDecrementTotal: handleDecrementTotal,
    onRemoveLink: handleRemoveLink,
  });

  const handleLoadMore = useCallback(() => {
    dispatchFetchParams({ type: 'load-more' });
  }, []);

  const handleToggleForm = useCallback(() => {
    setShowLinkForm((open) => !open);
  }, []);

  const handleDismissToast = useCallback(() => {
    setToastMessage(null);
  }, []);

  return {
    handleCreated,
    handleDeleteAllArchived,
    handleDismissToast,
    handleLoadMore,
    handleRandom,
    handleToggleArchive,
    handleToggleForm,
    links,
    loadingLinks,
    page: fetchParams.page,
    pagination,
    randomError,
    randomLoading,
    saveError,
    showLinkForm,
    toastMessage,
  };
}
