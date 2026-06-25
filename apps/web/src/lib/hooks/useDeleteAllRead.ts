import { deleteAllReadLinks } from '../api';
import { getErrorMessage } from '../errors';
import { useCallback, useState } from 'react';

interface UseDeleteAllReadOptions {
  clearLinks: () => void;
  resetTotal: () => void;
}

export interface UseDeleteAllReadResult {
  deleteError: string | null;
  /** Calls `DELETE /links/read`, then clears the list and resets the total. */
  handleDeleteAllRead: () => Promise<void>;
}

/**
 * Owns the "delete all read links" action. On success it clears the in-memory
 * list and resets the pagination total so the view reflects the empty state
 * without a refetch.
 *
 * @param options - List-reset helpers from `useLinksData`.
 * @returns The delete handler and the delete error state for the view layer.
 */
export function useDeleteAllRead({
  clearLinks,
  resetTotal,
}: UseDeleteAllReadOptions): UseDeleteAllReadResult {
  const [deleteError, setDeleteError] = useState<string | null>(null);

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

  return { deleteError, handleDeleteAllRead };
}
