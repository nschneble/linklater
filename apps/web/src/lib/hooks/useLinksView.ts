import { filterFromPath } from './useLinksView.utils';
import { useAggregatedError } from './useAggregatedError';
import { useEffect, useRef, useState } from 'react';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';
import { useLinkSelection } from './useLinkSelection';
import { useLinks } from './useLinks';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSearchDebounce } from './useSearchDebounce';
import type { LinksFilter } from './types';

export { filterFromPath } from './useLinksView.utils';

interface UseLinksViewOptions {
  /**
   * Called when the keyboard shortcuts modal opens, so the parent can close
   * any other menus (e.g. the user menu).
   */
  onCloseUserMenu?: () => void;
}

/** Everything the `LinksView` component needs from this hook. */
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

/**
 * Controller hook for `LinksView`. Composes the focused sub-hooks that own
 * each slice of state — URL-derived filter, search debounce
 * (`useSearchDebounce`), keyboard selection (`useLinkSelection`), and the
 * aggregated error (`useAggregatedError`) — wires up keyboard shortcuts, and
 * re-exposes a single, stable API. The shortcuts modal flag and the
 * clear-read animation flag stay here because they are small and coupled to
 * this hook's wiring.
 *
 * What stays in the view:
 * - `dialogReference` – attached to a JSX element and consumed directly by
 *   `useFocusTrap`; threading it through the hook would add complexity with
 *   no benefit.
 * - `useFocusTrap` + `useFocusReturn` – one-liner DOM hooks that sit next to
 *   their respective refs in the JSX.
 */
export function useLinksView({
  onCloseUserMenu,
}: UseLinksViewOptions = {}): UseLinksViewResult {
  const location = useLocation();
  const navigate = useNavigate();
  const filter = filterFromPath(location.pathname);

  const [showShortcuts, setShowShortcuts] = useState(false);
  const [isClearingRead, setIsClearingRead] = useState(false);
  const searchInputReference = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showShortcuts) onCloseUserMenu?.();
  }, [showShortcuts, onCloseUserMenu]);

  const { search, debouncedSearch, setSearch } = useSearchDebounce(filter);
  const linksResult = useLinks(filter, debouncedSearch);

  const {
    selectedLinkIndex,
    handleNavigateNextLink,
    handleNavigatePrevLink,
    handleOpenSelectedLink,
  } = useLinkSelection({
    debouncedSearch,
    filter,
    links: linksResult.links,
    onToggleRead: linksResult.handleToggleRead,
  });

  useKeyboardShortcuts({
    enabled: true,
    isShortcutsModalOpen: showShortcuts,
    onShowUnread: () => navigate('/unread'),
    onShowRead: () => navigate('/read'),
    onSearch: () => searchInputReference.current?.focus(),
    onToggleForm: filter === 'unread' ? linksResult.handleToggleForm : () => {},
    onStumble: filter === 'unread' ? linksResult.handleRandom : () => {},
    onToggleShortcuts: () => setShowShortcuts((previous) => !previous),
    onEscape: linksResult.showLinkForm
      ? linksResult.handleToggleForm
      : undefined,
    onNavigateNextLink: handleNavigateNextLink,
    onNavigatePrevLink: handleNavigatePrevLink,
    onOpenSelectedLink: handleOpenSelectedLink,
  });

  const error = useAggregatedError({
    deleteError: linksResult.deleteError,
    fetchError: linksResult.fetchError,
    randomError: linksResult.randomError,
    readError: linksResult.readError,
    saveError: linksResult.saveError,
  });

  /**
   * Triggers the card exit animation before calling `handleDeleteAllRead`.
   * `isClearingRead` is set to `true` immediately so `LinksList` can start
   * animating cards out, then cleared in `finally` regardless of success or
   * failure so the UI never gets stuck in the animating state.
   */
  async function handleClearRead() {
    setIsClearingRead(true);
    try {
      await linksResult.handleDeleteAllRead();
    } finally {
      setIsClearingRead(false);
    }
  }

  return {
    debouncedSearch,
    deleteError: linksResult.deleteError,
    error,
    fetchError: linksResult.fetchError,
    filter,
    handleClearRead,
    handleCreated: linksResult.handleCreated,
    handleDismissToast: linksResult.handleDismissToast,
    handleLoadMore: linksResult.handleLoadMore,
    handleRandom: linksResult.handleRandom,
    handleToggleForm: linksResult.handleToggleForm,
    handleToggleRead: linksResult.handleToggleRead,
    hasSettledOnce: linksResult.hasSettledOnce,
    isClearingRead,
    links: linksResult.links,
    loadingLinks: linksResult.loadingLinks,
    newLinksAnnouncement: linksResult.newLinksAnnouncement,
    onCloseShortcuts: () => setShowShortcuts(false),
    onNavigateRead: () => navigate('/read'),
    onNavigateUnread: () => navigate('/unread'),
    onSearch: setSearch,
    onToggleShortcuts: () => setShowShortcuts((previous) => !previous),
    page: linksResult.page,
    pagination: linksResult.pagination,
    randomError: linksResult.randomError,
    randomLoading: linksResult.randomLoading,
    readError: linksResult.readError,
    saveError: linksResult.saveError,
    search,
    searchInputReference,
    selectedLinkIndex,
    showLinkForm: linksResult.showLinkForm,
    showShortcuts,
    toastMessage: linksResult.toastMessage,
  };
}
