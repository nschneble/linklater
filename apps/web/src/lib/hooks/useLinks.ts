import { useLinksActions } from './useLinksActions';
import { useLinksData } from './useLinksData';
import { useLinksForm } from './useLinksForm';
import type { LinksFilter, UseLinksResult } from './types';

export type { LinksFilter, UseLinksResult };

/**
 * Facade hook that composes `useLinksData`, `useLinksActions`, and
 * `useLinksForm` into a single, stable API for `LinksView`.
 *
 * Splitting the implementation across three hooks keeps each concern small
 * and independently testable. This facade is what `LinksView` actually
 * calls — it does not need to know about the internals.
 *
 * @param filter - Whether to show unread or read links.
 * @param search - The current full-text search term (debounced by the caller).
 * @returns The combined state and handlers for the links view.
 */
export function useLinks(filter: LinksFilter, search: string): UseLinksResult {
  const data = useLinksData(filter, search);
  const actions = useLinksActions({
    adjustTotal: data.adjustTotal,
    clearLinks: data.clearLinks,
    filter,
    links: data.links,
    prependLink: data.prependLink,
    removeLink: data.removeLink,
    resetTotal: data.resetTotal,
    updateLink: data.updateLink,
  });

  // Paste detection is disabled on the read tab because saving a new
  // link while viewing read links would be confusing; the saved link would
  // appear on a different tab.
  const form = useLinksForm({
    enabled: filter !== 'read',
    onDirectSave: actions.handleDirectSave,
  });

  return {
    fetchError: data.fetchError,
    readError: actions.readError,
    deleteError: actions.deleteError,
    handleCreated: actions.handleCreated,
    handleDeleteAllRead: actions.handleDeleteAllRead,
    handleDismissToast: actions.handleDismissToast,
    handleLoadMore: data.handleLoadMore,
    handleRandom: actions.handleRandom,
    handleToggleRead: actions.handleToggleRead,
    handleToggleForm: form.handleToggleForm,
    links: data.links,
    loadingLinks: data.loadingLinks,
    newLinksAnnouncement: data.newLinksAnnouncement,
    page: data.page,
    pagination: data.pagination,
    randomError: actions.randomError,
    randomLoading: actions.randomLoading,
    saveError: actions.saveError,
    showLinkForm: form.showLinkForm,
    toastMessage: actions.toastMessage,
  };
}
