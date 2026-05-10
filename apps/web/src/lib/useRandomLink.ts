import { readLink, getRandomLink } from './api';
import { useCallback, useState } from 'react';

interface UseRandomLinkOptions {
  /** Called after the random link is removed from the current list to keep the total count accurate. */
  onDecrementTotal: () => void;
  /** Called with the link ID to remove it from the in-memory list after it has been opened. */
  onRemoveLink: (linkId: string) => void;
}

export interface UseRandomLinkResult {
  /** Opens a random link in a new tab. Marks the link as read after opening. */
  handleRandom: () => Promise<void>;
  /** Error message from the most recent stumble attempt, or `null`. */
  randomError: string | null;
  /** `true` while a stumble request is in flight. */
  randomLoading: boolean;
}

/**
 * Manages the "Stumble upon" feature. Fetches a random unread link, opens
 * it in a new tab, and immediately marks it as read.
 *
 * Note: Opening a new tab requires being called from inside a user-gesture
 * handler. This hook is always triggered by a button click or keyboard
 * shortcut, so it should avoid being suppressed by a popup blocker.
 *
 * @param options.onDecrementTotal - Called to adjust the pagination total after removal.
 * @param options.onRemoveLink - Called with the link ID to remove it from local state.
 */
export function useRandomLink({
  onDecrementTotal,
  onRemoveLink,
}: UseRandomLinkOptions): UseRandomLinkResult {
  const [randomError, setRandomError] = useState<string | null>(null);
  const [randomLoading, setRandomLoading] = useState(false);

  const handleRandom = useCallback(async () => {
    setRandomError(null);
    setRandomLoading(true);
    try {
      const { link } = await getRandomLink();
      if (!link) {
        setRandomError('No links available');
      } else {
        window.open(link.url, '_blank', 'noopener,noreferrer');
        try {
          await readLink(link.id);
          onRemoveLink(link.id);
          onDecrementTotal();
        } catch (error: unknown) {
          console.error('Failed to mark link as read after opening', error);
        }
      }
    } catch (error: unknown) {
      setRandomError('Failed to get a random link');
      console.error('Failed to get a random link', error);
    } finally {
      setRandomLoading(false);
    }
  }, [onDecrementTotal, onRemoveLink]);

  return { handleRandom, randomError, randomLoading };
}
