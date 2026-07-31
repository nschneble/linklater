import { createLink, type Link } from '../api';
import { getErrorMessage } from '../errors';
import { useCallback, useRef, useState } from 'react';
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
}

export interface UseCreateLinkResult {
  /**
   * Called by `LinkForm` / paste detection after a successful create.
   * Prepends the new link, increments the total, and notifies the caller.
   * No-ops when the read tab is active, since newly created links should not
   * appear there. Metadata polling is not started here: the prepended link
   * lands in list state and `usePendingMetadataPolling` (wired at
   * `useLinksData`) picks it up from there.
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
 * Owns the link-creation flow: prepending a new link and the direct-save path
 * used by paste detection.
 *
 * A created link is prepended into list state; metadata polling is no longer
 * this hook's concern. `usePendingMetadataPolling` (wired at `useLinksData`)
 * derives its pending set from list state, so the prepended link is picked up
 * and settled from there once the server reports its metadata fetched.
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
}: UseCreateLinkOptions): UseCreateLinkResult {
  // refs keep handleCreated stable; no paste-listener re-register
  const linksReference = useRef(links);
  linksReference.current = links;
  const onSavedReference = useRef(onSaved);
  onSavedReference.current = onSaved;

  const [saveError, setSaveError] = useState<string | null>(null);

  const handleCreated = useCallback(
    (link: Link) => {
      if (filter === 'read') return;
      const isNew = !linksReference.current.some((item) => item.id === link.id);
      if (isNew) adjustTotal(1);
      prependLink(link);
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
