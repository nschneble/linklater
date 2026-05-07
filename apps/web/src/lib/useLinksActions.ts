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

/**
 * The mutation helpers and list state that `useLinksActions` needs from
 * `useLinksData` in order to keep the rendered list in sync after each action.
 */
interface UseLinksActionsOptions {
  /** See `UseLinksDataResult.adjustTotal`. */
  adjustTotal: (delta: number) => void;
  /** See `UseLinksDataResult.clearLinks`. */
  clearLinks: () => void;
  /** The active tab filter — needed to decide whether to remove a link after archive/unarchive. */
  filter: LinksFilter;
  /** Current links array — used to detect whether a newly created link is truly new. */
  links: Link[];
  /** See `UseLinksDataResult.prependLink`. */
  prependLink: (link: Link) => void;
  /** See `UseLinksDataResult.removeLink`. */
  removeLink: (linkId: string) => void;
  /** See `UseLinksDataResult.resetTotal`. */
  resetTotal: () => void;
  /** See `UseLinksDataResult.updateLink`. */
  updateLink: (link: Link) => void;
}

/** Everything exposed by `useLinksActions`. */
export interface UseLinksActionsResult {
  /** Error message from the most recent archive/unarchive attempt, or `null`. */
  archiveError: string | null;
  /** Error message from the most recent "delete all archived" attempt, or `null`. */
  deleteError: string | null;
  /**
   * Called by `LinkForm` / paste detection after a successful create. Prepends
   * the new link, starts metadata polling, increments the total, and shows a
   * toast. No-ops when the archived tab is active (newly created links should
   * not appear there).
   */
  handleCreated: (link: Link) => void;
  /** Calls `DELETE /links/archived`, then clears the list and resets the total. */
  handleDeleteAllArchived: () => Promise<void>;
  /** Hides the success toast. */
  handleDismissToast: () => void;
  /**
   * Saves a link directly from a URL string (bypasses the form). Used by paste
   * detection. Calls `POST /links` and then delegates to `handleCreated`.
   */
  handleDirectSave: (url: string) => Promise<void>;
  /**
   * Archives an unread link or unarchives a read link, then removes it from
   * the list if it no longer belongs in the current filter.
   */
  handleToggleArchive: (link: Link) => Promise<void>;
  /** Opens a random unread link in a new tab and archives it. */
  handleRandom: () => Promise<void>;
  /** Error message from the most recent "stumble upon" attempt, or `null`. */
  randomError: string | null;
  /** `true` while a "stumble upon" request is in flight. */
  randomLoading: boolean;
  /** Error message from the most recent direct save, or `null`. */
  saveError: string | null;
  /** The text of the current success toast, or `null` when no toast is showing. */
  toastMessage: string | null;
}

/**
 * Handles all user-initiated link mutations: create, archive/unarchive, delete
 * all archived, and random stumble. Coordinates with `useLinksData` mutation
 * helpers to keep the list in sync without a full refetch after each operation.
 *
 * Also drives the metadata polling cycle — when a link is created, polling
 * starts for that link's id and stops when the server reports that metadata
 * has been fetched (`meta.fetchedAt` is set).
 *
 * @param options - Mutation helpers and current state from `useLinksData`.
 * @returns Action handlers and error/loading state for the view layer.
 */
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
  const [deleteError, setDeleteError] = useState<string | null>(null);
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
    setDeleteError(null);
    try {
      await deleteAllArchivedLinks();
      clearLinks();
      resetTotal();
    } catch (error: unknown) {
      setDeleteError(getErrorMessage(error, 'Failed to delete archived links'));
    }
  }, [clearLinks, resetTotal]);

  const { handleRandom, randomError, randomLoading } = useRandomLink({
    filter,
    onDecrementTotal: () => adjustTotal(-1),
    onRemoveLink: removeLink,
  });

  const handleDismissToast = useCallback(() => {
    setToastMessage(null);
  }, []);

  return {
    archiveError,
    deleteError,
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
