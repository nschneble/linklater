import { readLink, unreadLink, type Link } from '../api';
import { getErrorMessage } from '../errors';
import { useCallback, useState } from 'react';
import type { LinksFilter } from './types';

interface UseToggleReadLinkOptions {
  adjustTotal: (delta: number) => void;
  // decides whether to remove a link after toggling its read state
  filter: LinksFilter;
  removeLink: (linkId: string) => void;
  updateLink: (link: Link) => void;
}

export interface UseToggleReadLinkResult {
  /**
   * Marks/unmarks a link as read, then removes it from the list if it no
   * longer belongs in the current filter.
   */
  handleToggleRead: (link: Link) => Promise<void>;
  readError: string | null;
}

/**
 * Owns the read/unread toggle. After the server confirms the new state, the
 * link is removed from the list when it no longer matches the active filter,
 * or updated in place when it stays.
 *
 * @param options - Mutation helpers and current filter from `useLinksData`.
 * @returns The toggle handler and the read error state for the view layer.
 */
export function useToggleReadLink({
  adjustTotal,
  filter,
  removeLink,
  updateLink,
}: UseToggleReadLinkOptions): UseToggleReadLinkResult {
  const [readError, setReadError] = useState<string | null>(null);

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

  return { handleToggleRead, readError };
}
