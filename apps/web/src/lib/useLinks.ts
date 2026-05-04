import { useLinksActions } from './useLinksActions';
import { useLinksData } from './useLinksData';
import { useLinksForm } from './useLinksForm';
import type { Link, PaginatedLinks } from './api';

export type LinksFilter = 'active' | 'archived';

export interface UseLinksResult {
  handleCreated: (link: Link) => void;
  handleDeleteAllArchived: () => Promise<void>;
  handleDismissToast: () => void;
  handleLoadMore: () => void;
  handleRandom: () => Promise<void>;
  handleToggleArchive: (link: Link) => Promise<void>;
  handleToggleForm: () => void;
  links: Link[];
  loadingLinks: boolean;
  page: number;
  pagination: Pick<PaginatedLinks, 'total' | 'limit'> | null;
  randomError: string | null;
  randomLoading: boolean;
  saveError: string | null;
  showLinkForm: boolean;
  toastMessage: string | null;
}

export function useLinks(filter: LinksFilter, search: string): UseLinksResult {
  const data = useLinksData(filter, search);
  const actions = useLinksActions({
    filter,
    setLinks: data.setLinks,
    setPagination: data.setPagination,
  });
  const form = useLinksForm({ onDirectSave: actions.handleDirectSave });

  return {
    handleCreated: actions.handleCreated,
    handleDeleteAllArchived: actions.handleDeleteAllArchived,
    handleDismissToast: actions.handleDismissToast,
    handleLoadMore: data.handleLoadMore,
    handleRandom: actions.handleRandom,
    handleToggleArchive: actions.handleToggleArchive,
    handleToggleForm: form.handleToggleForm,
    links: data.links,
    loadingLinks: data.loadingLinks,
    page: data.page,
    pagination: data.pagination,
    randomError: actions.randomError,
    randomLoading: actions.randomLoading,
    saveError: actions.saveError,
    showLinkForm: form.showLinkForm,
    toastMessage: actions.toastMessage,
  };
}
