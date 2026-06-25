import type { LinksFilter } from './types';
import type { useLinks } from './useLinks';

/** Everything the `LinksView` component needs from `useLinksView`. */
export interface UseLinksViewResult {
  debouncedSearch: string;
  /**
   * Most-recently-set error across the five sub-error fields below. Drives
   * the single visible `Alert` so that `role="alert"` mounts/unmounts at
   * most once per transition – concurrent failures (e.g. background fetch +
   * user save) no longer cascade multiple assertive announcements.
   */
  error: string | null;
  filter: LinksFilter;
  isClearingRead: boolean;
  search: string;
  searchInputReference: React.RefObject<HTMLInputElement | null>;
  selectedLinkIndex: number | null;
  showShortcuts: boolean;
  onCloseShortcuts: () => void;
  onNavigateRead: () => void;
  onNavigateUnread: () => void;
  onSearch: (value: string) => void;
  onToggleShortcuts: () => void;
  // Forwarded from useLinks
  deleteError: string | null;
  fetchError: string | null;
  handleClearRead: () => Promise<void>;
  handleCreated: ReturnType<typeof useLinks>['handleCreated'];
  handleDismissToast: () => void;
  handleLoadMore: () => void;
  handleRandom: () => Promise<void>;
  handleToggleForm: () => void;
  handleToggleRead: ReturnType<typeof useLinks>['handleToggleRead'];
  /** See `UseLinksDataResult.hasSettledOnce`. */
  hasSettledOnce: boolean;
  links: ReturnType<typeof useLinks>['links'];
  loadingLinks: boolean;
  newLinksAnnouncement: string;
  page: number;
  pagination: ReturnType<typeof useLinks>['pagination'];
  randomError: string | null;
  randomLoading: boolean;
  readError: string | null;
  saveError: string | null;
  showLinkForm: boolean;
  toastMessage: string | null;
}
