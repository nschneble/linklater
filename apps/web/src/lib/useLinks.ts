import {
  archiveLink,
  createLink,
  deleteAllArchivedLinks,
  getLinks,
  getRandomLink,
  unarchiveLink,
  type Link,
  type PaginatedLinks,
} from './api';

import { getErrorMessage } from './errors';
import { useCallback, useEffect, useState } from 'react';
import { useMetadataPolling } from './useMetadataPolling';
import { usePasteDetection } from './usePasteDetection';

type LinksFilter = 'active' | 'archived';

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
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<Pick<
    PaginatedLinks,
    'total' | 'limit'
  > | null>(null);
  const [pendingMetaLinkId, setPendingMetaLinkId] = useState<string | null>(
    null,
  );
  const [randomError, setRandomError] = useState<string | null>(null);
  const [randomLoading, setRandomLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  useMetadataPolling(pendingMetaLinkId, (updatedLink) => {
    setLinks((previous) =>
      previous.map((link) => (link.id === updatedLink.id ? updatedLink : link)),
    );
    setPendingMetaLinkId(null);
  });

  // resets to page 1 when the search or filter changes
  useEffect(() => {
    setPage(1);
  }, [search, filter]);

  // loads links when the search, filter, or page changes
  useEffect(() => {
    let cancelled = false;

    if (page === 1) setLinks([]);
    setLoadingLinks(true);

    const load = async () => {
      try {
        const result = await getLinks({
          search: search || undefined,
          archived: filter === 'archived',
          page,
        });
        if (!cancelled) {
          if (page === 1) {
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
  }, [search, filter, page]);

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

  const handleRandom = useCallback(async () => {
    setRandomError(null);
    setRandomLoading(true);
    try {
      const { link } = await getRandomLink({
        archived: filter === 'archived',
      });
      if (!link) {
        setRandomError('No links available');
      } else {
        window.open(link.url, '_blank', 'noopener,noreferrer');
        if (!link.archivedAt) {
          await archiveLink(link.id);
          setLinks((previous) =>
            previous.filter((item) => item.id !== link.id),
          );
          setPagination((previous) =>
            previous ? { ...previous, total: previous.total - 1 } : previous,
          );
        }
      }
    } catch (error: unknown) {
      setRandomError('Failed to get a random link');
      console.error('Failed to get a random link', error);
    } finally {
      setRandomLoading(false);
    }
  }, [filter]);

  const handleLoadMore = useCallback(() => {
    setPage((previous) => previous + 1);
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
    page,
    pagination,
    randomError,
    randomLoading,
    saveError,
    showLinkForm,
    toastMessage,
  };
}
