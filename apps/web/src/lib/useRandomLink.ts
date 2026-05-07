import { archiveLink, getRandomLink } from './api';
import { useCallback, useState } from 'react';

type LinksFilter = 'active' | 'archived';

interface UseRandomLinkOptions {
  /** The current tab filter — determines whether to pick from active or archived links. */
  filter: LinksFilter;
  /** Called after the random link is removed from the current list to keep the total count accurate. */
  onDecrementTotal: () => void;
  /** Called with the link ID to remove it from the in-memory list after it has been opened. */
  onRemoveLink: (linkId: string) => void;
}

export interface UseRandomLinkResult {
  /** Opens a random link in a new tab. Archives unread links after opening. */
  handleRandom: () => Promise<void>;
  /** Error message from the most recent stumble attempt, or `null`. */
  randomError: string | null;
  /** `true` while a stumble request is in flight. */
  randomLoading: boolean;
}

/**
 * Manages the "Stumble upon" feature: fetches a random unread link, opens it
 * in a new tab, and immediately archives it so it does not appear again.
 *
 * When viewing the archived tab, the random link is opened but not re-archived
 * (it is already archived). In both cases the link is removed from the visible
 * list via `onRemoveLink` so the UI stays consistent without a re-fetch.
 *
 * NOTE: Opening a new tab (`window.open`) requires being called from inside a
 * user-gesture handler (click or keypress). This hook is always triggered by
 * a button click or keyboard shortcut, so the popup blocker should not fire.
 *
 * @param options.filter - The current links filter.
 * @param options.onDecrementTotal - Called to adjust the pagination total after removal.
 * @param options.onRemoveLink - Called with the link ID to remove it from local state.
 */
export function useRandomLink({
  filter,
  onDecrementTotal,
  onRemoveLink,
}: UseRandomLinkOptions): UseRandomLinkResult {
  const [randomError, setRandomError] = useState<string | null>(null);
  const [randomLoading, setRandomLoading] = useState(false);

  const handleRandom = useCallback(async () => {
    setRandomError(null);
    setRandomLoading(true);
    try {
      const { link } = await getRandomLink({ archived: filter === 'archived' });
      if (!link) {
        setRandomError('No links available');
      } else {
        window.open(link.url, '_blank', 'noopener,noreferrer');
        // Only archive when viewing unread links — archived links are already archived.
        if (!link.archivedAt) {
          try {
            await archiveLink(link.id);
            onRemoveLink(link.id);
            onDecrementTotal();
          } catch (error: unknown) {
            console.error('Failed to archive link after opening', error);
          }
        }
      }
    } catch (error: unknown) {
      setRandomError('Failed to get a random link');
      console.error('Failed to get a random link', error);
    } finally {
      setRandomLoading(false);
    }
  }, [filter, onDecrementTotal, onRemoveLink]);

  return { handleRandom, randomError, randomLoading };
}
