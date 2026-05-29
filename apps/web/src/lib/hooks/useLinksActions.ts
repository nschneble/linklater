import {
  createLink,
  deleteAllReadLinks,
  readLink,
  unreadLink,
  type Link,
} from '../api';
import { getErrorMessage } from '../errors';
import { useCallback, useRef, useState } from 'react';
import { useMetadataPolling } from './useMetadataPolling';
import { useRandomLink } from './useRandomLink';
import type { LinksFilter } from './useLinks';

/**
 * The mutation helpers and list state that `useLinksActions` needs from
 * `useLinksData` in order to keep the rendered list in sync after each
 * action.
 */
interface UseLinksActionsOptions {
  adjustTotal: (delta: number) => void;
  clearLinks: () => void;
  // needed to decide whether to remove a link after reading
  filter: LinksFilter;
  // used to detect whether a newly created link is truly new
  links: Link[];
  prependLink: (link: Link) => void;
  removeLink: (linkId: string) => void;
  resetTotal: () => void;
  updateLink: (link: Link) => void;
}

export interface UseLinksActionsResult {
  readError: string | null;
  deleteError: string | null;
  /**
   * Called by `LinkForm` / paste detection after a successful create.
   * Prepends the new link, starts metadata polling, increments the total,
   * and shows a toast. No-ops when the read tab is active, since newly
   * created links should not appear there.
   */
  handleCreated: (link: Link) => void;
  /** Calls `DELETE /links/read`, then clears the list and resets the total. */
  handleDeleteAllRead: () => Promise<void>;
  handleDismissToast: () => void;
  /**
   * Saves a link directly from a URL string. Used by paste detection.
   * Calls `POST /links` and then delegates to `handleCreated`.
   */
  handleDirectSave: (url: string) => Promise<void>;
  /**
   * Marks/unmarks a link as read, then removes it from the list if it no
   * longer belongs in the current filter.
   */
  handleToggleRead: (link: Link) => Promise<void>;
  handleRandom: () => Promise<void>;
  randomError: string | null;
  randomLoading: boolean;
  saveError: string | null;
  toastMessage: string | null;
}

/**
 * Handles all user-initiated link mutations: create, read/unread, delete
 * all read, and stumble! Coordinates with `useLinksData` mutation
 * helpers to keep the list in sync without a full refetch after each
 * operation.
 *
 * Also drives the metadata polling cycle. When a link is created, polling
 * starts for the link's id and stops when the server reports that metadata
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
  // GOTCHA: links is stored in a ref so handleCreated always reads the latest
  // list without including the array in its dependency array. Adding links
  // would recreate handleCreated on every fetch/mutation, which in turn
  // recreates handleDirectSave and unnecessarily re-registers the paste
  // event listener in usePasteDetection.
  const linksReference = useRef(links);
  linksReference.current = links;

  const [pendingMetaLinkId, setPendingMetaLinkId] = useState<string | null>(
    null,
  );
  const [readError, setReadError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useMetadataPolling(pendingMetaLinkId, (updatedLink) => {
    updateLink(updatedLink);
    setPendingMetaLinkId(null);
  });

  const handleCreated = useCallback(
    (link: Link) => {
      if (filter === 'read') return;
      const isNew = !linksReference.current.some((item) => item.id === link.id);
      if (isNew) adjustTotal(1);
      prependLink(link);
      setPendingMetaLinkId(link.id);
      setToastMessage('Link saved!');
    },
    [filter, adjustTotal, prependLink],
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

  const handleToggleRead = useCallback(
    async (link: Link) => {
      setReadError(null);
      try {
        const updated = link.readAt
          ? await unreadLink(link.id)
          : await readLink(link.id);

        const isFilteredOut =
          (filter === 'unread' && updated.readAt) ||
          (filter === 'read' && !updated.readAt);

        if (isFilteredOut) {
          removeLink(updated.id);
          adjustTotal(-1);
        } else {
          updateLink(updated);
        }
      } catch (error: unknown) {
        setReadError(getErrorMessage(error, 'Failed to update link'));
      }
    },
    [filter, adjustTotal, removeLink, updateLink],
  );

  const handleDeleteAllRead = useCallback(async () => {
    setDeleteError(null);
    try {
      await deleteAllReadLinks();
      clearLinks();
      resetTotal();
    } catch (error: unknown) {
      setDeleteError(getErrorMessage(error, 'Failed to delete read links'));
    }
  }, [clearLinks, resetTotal]);

  const { handleRandom, randomError, randomLoading } = useRandomLink({
    onDecrementTotal: () => adjustTotal(-1),
    onNoLinks: () => setToastMessage('No links to stumble upon'),
    onRemoveLink: removeLink,
  });

  const handleDismissToast = useCallback(() => {
    setToastMessage(null);
  }, []);

  return {
    readError,
    deleteError,
    handleCreated,
    handleDeleteAllRead,
    handleDismissToast,
    handleDirectSave,
    handleRandom,
    handleToggleRead,
    randomError,
    randomLoading,
    saveError,
    toastMessage,
  };
}
