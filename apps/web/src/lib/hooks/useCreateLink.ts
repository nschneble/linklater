import { createLink, type Link } from '../api';
import { getErrorMessage } from '../errors';
import { useCallback, useRef, useState } from 'react';
import { useMetadataPolling } from './useMetadataPolling';
import type { LinksFilter } from './types';

interface UseCreateLinkOptions {
  adjustTotal: (delta: number) => void;
  // needed to decide whether a newly created link should appear at all
  filter: LinksFilter;
  // used to detect whether a newly created link is truly new
  links: Link[];
  // called after a successful create so the caller can show a toast
  onSaved: () => void;
  prependLink: (link: Link) => void;
  updateLink: (link: Link) => void;
}

export interface UseCreateLinkResult {
  /**
   * Called by `LinkForm` / paste detection after a successful create.
   * Prepends the new link, starts metadata polling, increments the total,
   * and notifies the caller. No-ops when the read tab is active, since newly
   * created links should not appear there.
   */
  handleCreated: (link: Link) => void;
  /**
   * Saves a link directly from a URL string. Used by paste detection.
   * Calls `POST /links` and then delegates to `handleCreated`.
   */
  handleDirectSave: (url: string) => Promise<void>;
  saveError: string | null;
}

/**
 * Owns the link-creation flow: prepending a new link, kicking off metadata
 * polling for it, and the direct-save path used by paste detection.
 *
 * When a link is created, polling starts for the link's id and stops when the
 * server reports that metadata has been fetched (`meta.fetchedAt` is set).
 *
 * @param options - Mutation helpers and current state from `useLinksData`.
 * @returns Create handlers and the save error state for the view layer.
 */
export function useCreateLink({
  adjustTotal,
  filter,
  links,
  onSaved,
  prependLink,
  updateLink,
}: UseCreateLinkOptions): UseCreateLinkResult {
  // GOTCHA: links and onSaved are stored in refs so handleCreated always reads
  // the latest values without including them in its dependency array. Adding
  // either would recreate handleCreated on every fetch/mutation (links changes
  // constantly, onSaved is a fresh closure each render), which in turn recreates
  // handleDirectSave and unnecessarily re-registers the paste event listener in
  // usePasteDetection.
  const linksReference = useRef(links);
  linksReference.current = links;
  const onSavedReference = useRef(onSaved);
  onSavedReference.current = onSaved;

  const [pendingMetaLinkId, setPendingMetaLinkId] = useState<string | null>(
    null,
  );
  const [saveError, setSaveError] = useState<string | null>(null);

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
      onSavedReference.current();
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

  return { handleCreated, handleDirectSave, saveError };
}
