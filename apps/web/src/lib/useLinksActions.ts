import {
  archiveLink,
  createLink,
  deleteAllArchivedLinks,
  unarchiveLink,
  type Link,
} from './api';
import { getErrorMessage } from './errors';
import { useCallback, useState } from 'react';
import { useMetadataPolling } from './useMetadataPolling';
import { useRandomLink } from './useRandomLink';
import type { LinksFilter } from './useLinks';

interface UseLinksActionsOptions {
  adjustTotal: (delta: number) => void;
  clearLinks: () => void;
  filter: LinksFilter;
  links: Link[];
  prependLink: (link: Link) => void;
  removeLink: (linkId: string) => void;
  resetTotal: () => void;
  updateLink: (link: Link) => void;
}

export interface UseLinksActionsResult {
  archiveError: string | null;
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
  adjustTotal,
  clearLinks,
  filter,
  links,
  prependLink,
  removeLink,
  resetTotal,
  updateLink,
}: UseLinksActionsOptions): UseLinksActionsResult {
  const [pendingMetaLinkId, setPendingMetaLinkId] = useState<string | null>(
    null,
  );
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useMetadataPolling(pendingMetaLinkId, (updatedLink) => {
    updateLink(updatedLink);
    setPendingMetaLinkId(null);
  });

  const handleCreated = useCallback(
    (link: Link) => {
      if (filter === 'archived') return;
      const isNew = !links.some((item) => item.id === link.id);
      if (isNew) adjustTotal(1);
      prependLink(link);
      setPendingMetaLinkId(link.id);
      setToastMessage('Link saved!');
    },
    [filter, links, adjustTotal, prependLink],
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
      setArchiveError(null);
      try {
        const updated = link.archivedAt
          ? await unarchiveLink(link.id)
          : await archiveLink(link.id);

        const isFilteredOut =
          (filter === 'active' && updated.archivedAt) ||
          (filter === 'archived' && !updated.archivedAt);

        if (isFilteredOut) {
          removeLink(updated.id);
          adjustTotal(-1);
        } else {
          updateLink(updated);
        }
      } catch (error: unknown) {
        setArchiveError(getErrorMessage(error, 'Failed to update link'));
      }
    },
    [filter, adjustTotal, removeLink, updateLink],
  );

  const handleDeleteAllArchived = useCallback(async () => {
    try {
      await deleteAllArchivedLinks();
      clearLinks();
      resetTotal();
    } catch (error: unknown) {
      console.error('Failed to delete all archived links', error);
    }
  }, [clearLinks, resetTotal]);

  const handleRemoveLink = useCallback(
    (linkId: string) => {
      removeLink(linkId);
    },
    [removeLink],
  );

  const handleDecrementTotal = useCallback(() => {
    adjustTotal(-1);
  }, [adjustTotal]);

  const { handleRandom, randomError, randomLoading } = useRandomLink({
    filter,
    onDecrementTotal: handleDecrementTotal,
    onRemoveLink: handleRemoveLink,
  });

  const handleDismissToast = useCallback(() => {
    setToastMessage(null);
  }, []);

  return {
    archiveError,
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
