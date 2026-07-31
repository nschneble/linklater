import { useCreateLink } from './useCreateLink';
import { useDeleteAllRead } from './useDeleteAllRead';
import { useRandomLink } from './useRandomLink';
import { useToast } from './useToast';
import { useToggleReadLink } from './useToggleReadLink';
import type { Link } from '../api';
import type { LinksFilter } from './types';

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
  handleCreated: (link: Link) => void;
  handleDeleteAllRead: () => Promise<void>;
  handleDismissToast: () => void;
  handleDirectSave: (url: string) => Promise<void>;
  handleToggleRead: (link: Link) => Promise<void>;
  handleRandom: () => Promise<void>;
  randomError: string | null;
  randomLoading: boolean;
  saveError: string | null;
  toastMessage: string | null;
}

/**
 * Composes all user-initiated link mutations — create, read/unread, delete
 * all read, and stumble! — over the `useLinksData` mutation helpers so the
 * list stays in sync without a full refetch after each operation.
 *
 * The individual flows live in focused sub-hooks (`useCreateLink`,
 * `useToggleReadLink`, `useDeleteAllRead`, `useRandomLink`); this hook wires
 * them to the shared toast and re-exposes a single, stable API.
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
  const toast = useToast();

  const { handleCreated, handleDirectSave, saveError } = useCreateLink({
    adjustTotal,
    filter,
    links,
    onSaved: () => toast.show('Link saved!'),
    prependLink,
  });

  const { handleToggleRead, readError } = useToggleReadLink({
    adjustTotal,
    filter,
    removeLink,
    updateLink,
  });

  const { deleteError, handleDeleteAllRead } = useDeleteAllRead({
    clearLinks,
    resetTotal,
  });

  const { handleRandom, randomError, randomLoading } = useRandomLink({
    onDecrementTotal: () => adjustTotal(-1),
    onNoLinks: () => toast.show('No links to stumble upon'),
    onRemoveLink: removeLink,
  });

  return {
    readError,
    deleteError,
    handleCreated,
    handleDeleteAllRead,
    handleDismissToast: toast.dismiss,
    handleDirectSave,
    handleRandom,
    handleToggleRead,
    randomError,
    randomLoading,
    saveError,
    toastMessage: toast.message,
  };
}
