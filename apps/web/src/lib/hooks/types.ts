import type { Link, PaginatedLinks } from '../api';

/** The two possible views of the links list. */
export type LinksFilter = 'unread' | 'read';

/**
 * The full public interface returned by `useLinks`. Extracted from the facade
 * (`useLinks.ts`) so the sub-hooks (`useLinksActions`, `useLinksData`,
 * `useLinksView`) can import the type without depending on the facade —
 * breaks an otherwise circular import.
 */
export interface UseLinksResult {
  fetchError: string | null;
  readError: string | null;
  deleteError: string | null;
  handleCreated: (link: Link) => void;
  handleDeleteAllRead: () => Promise<void>;
  handleDismissToast: () => void;
  handleLoadMore: () => void;
  handleRandom: () => Promise<void>;
  handleToggleRead: (link: Link) => Promise<void>;
  handleToggleForm: () => void;
  links: Link[];
  loadingLinks: boolean;
  newLinksAnnouncement: string;
  page: number;
  pagination: Pick<PaginatedLinks, 'total' | 'limit'> | null;
  randomError: string | null;
  randomLoading: boolean;
  saveError: string | null;
  showLinkForm: boolean;
  toastMessage: string | null;
}
