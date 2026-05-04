import {
  archiveLink,
  createLink,
  deleteAllArchivedLinks,
  unarchiveLink,
  type Link,
  type PaginatedLinks,
} from './api';
import { getErrorMessage } from './errors';
import { useCallback, useState } from 'react';
import { useMetadataPolling } from './useMetadataPolling';
import { useRandomLink } from './useRandomLink';
import type { LinksFilter } from './useLinks';

interface UseLinksActionsOptions {
  filter: LinksFilter;
  setLinks: React.Dispatch<React.SetStateAction<Link[]>>;
  setPagination: React.Dispatch<
    React.SetStateAction<Pick<PaginatedLinks, 'total' | 'limit'> | null>
  >;
}

export interface UseLinksActionsResult {
  handleCreated: (link: Link) => void;
  handleDeleteAllArchived: () => Promise<void>;
  handleDismissToast: () => void;
  handleDirectSave: (url: string) => Promise<void>;
  handleToggleArchive: (link: Link) => Promise<void>;
  handleRandom: () => Promise<void>;
  randomError: string | null;
  randomLoading: boolean;
  saveError: string | null;
  toastMessage: string | null;
}

export function useLinksActions({
  filter,
  setLinks,
  setPagination,
}: UseLinksActionsOptions): UseLinksActionsResult {
  const [pendingMetaLinkId, setPendingMetaLinkId] = useState<string | null>(
    null,
  );
  const [saveError, setSaveError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useMetadataPolling(pendingMetaLinkId, (updatedLink) => {
    setLinks((previous) =>
      previous.map((link) => (link.id === updatedLink.id ? updatedLink : link)),
    );
    setPendingMetaLinkId(null);
  });

  const handleCreated = useCallback(
    (link: Link) => {
      if (filter === 'archived') return;
      setLinks((previous) => {
        const isNew = !previous.some((item) => item.id === link.id);
        if (isNew) {
          setPagination((previous) =>
            previous ? { ...previous, total: previous.total + 1 } : previous,
          );
        }
        return [link, ...previous.filter((item) => item.id !== link.id)];
      });
      setPendingMetaLinkId(link.id);
      setToastMessage('Link saved!');
    },
    [filter, setLinks, setPagination],
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
    [filter, setLinks, setPagination],
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
  }, [setLinks, setPagination]);

  const handleRemoveLink = useCallback(
    (linkId: string) => {
      setLinks((previous) => previous.filter((link) => link.id !== linkId));
    },
    [setLinks],
  );

  const handleDecrementTotal = useCallback(() => {
    setPagination((previous) =>
      previous ? { ...previous, total: previous.total - 1 } : previous,
    );
  }, [setPagination]);

  const { handleRandom, randomError, randomLoading } = useRandomLink({
    filter,
    onDecrementTotal: handleDecrementTotal,
    onRemoveLink: handleRemoveLink,
  });

  const handleDismissToast = useCallback(() => {
    setToastMessage(null);
  }, []);

  return {
    handleCreated,
    handleDeleteAllArchived,
    handleDismissToast,
    handleDirectSave,
    handleRandom,
    handleToggleArchive,
    randomError,
    randomLoading,
    saveError,
    toastMessage,
  };
}
