import { useEffect, useRef, useState, useTransition } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';
import { useLinks } from './useLinks';
import type { LinksFilter } from './useLinks';

/**
 * How long to wait after the user stops typing before firing the search
 * request.
 */
const SEARCH_DEBOUNCE_MS = 300;

/**
 * Maps the current URL pathname to the links filter.
 * `/read` → `'read'`, everything else → `'unread'`.
 */
export function filterFromPath(pathname: string): LinksFilter {
  return pathname === '/read' ? 'read' : 'unread';
}

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
 * Controller hook for `LinksView`. Owns all stateful logic: URL-derived
 * filter, search debounce, keyboard selection, shortcuts modal, and the
 * clear-read animation flag. Wires up keyboard shortcuts and exposes the
 * search input ref for `LinksToolbar`.
 *
 * What stays in the view:
 * - `dialogReference` — attached to a JSX element and consumed directly by
 *   `useFocusTrap`; threading it through the hook would add complexity with
 *   no benefit.
 * - `useFocusTrap` + `useFocusReturn` — one-liner DOM hooks that sit next to
 *   their respective refs in the JSX.
 */
export function useLinksView({
  onCloseUserMenu,
}: UseLinksViewOptions = {}): UseLinksViewResult {
  const location = useLocation();
  const navigate = useNavigate();
  const filter = filterFromPath(location.pathname);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedLinkIndex, setSelectedLinkIndex] = useState<number | null>(
    null,
  );
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [isClearingRead, setIsClearingRead] = useState(false);

  const [, startTransition] = useTransition();
  const searchInputReference = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showShortcuts) onCloseUserMenu?.();
  }, [showShortcuts, onCloseUserMenu]);

  useEffect(() => {
    if (search === '') {
      startTransition(() => setDebouncedSearch(''));
      return;
    }
    const timer = setTimeout(
      () => startTransition(() => setDebouncedSearch(search)),
      SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
  }, [search]);

  const {
    deleteError,
    fetchError,
    handleCreated,
    handleDeleteAllRead,
    handleDismissToast,
    handleLoadMore,
    handleRandom,
    handleToggleForm,
    handleToggleRead,
    links,
    loadingLinks,
    newLinksAnnouncement,
    page,
    pagination,
    randomError,
    randomLoading,
    readError,
    saveError,
    showLinkForm,
    toastMessage,
  } = useLinks(filter, debouncedSearch);

  function handleNavigateNextLink() {
    if (links.length === 0) return;
    setSelectedLinkIndex((previous) => {
      if (previous === null) return 0;
      return Math.min(previous + 1, links.length - 1);
    });
  }

  function handleNavigatePrevLink() {
    if (links.length === 0) return;
    setSelectedLinkIndex((previous) => {
      if (previous === null) return links.length - 1;
      return Math.max(previous - 1, 0);
    });
  }

  function handleOpenSelectedLink() {
    if (selectedLinkIndex === null) return;
    const link = links[selectedLinkIndex];
    if (!link) return;
    window.open(link.url, '_blank', 'noreferrer');
    if (!link.readAt) {
      handleToggleRead(link);
    }
  }

  useKeyboardShortcuts({
    enabled: true,
    isShortcutsModalOpen: showShortcuts,
    onShowUnread: () => navigate('/unread'),
    onShowRead: () => navigate('/read'),
    onSearch: () => searchInputReference.current?.focus(),
    onToggleForm: filter === 'unread' ? handleToggleForm : () => {},
    onStumble: filter === 'unread' ? handleRandom : () => {},
    onToggleShortcuts: () => setShowShortcuts((previous) => !previous),
    onEscape: showLinkForm ? handleToggleForm : undefined,
    onNavigateNextLink: handleNavigateNextLink,
    onNavigatePrevLink: handleNavigatePrevLink,
    onOpenSelectedLink: handleOpenSelectedLink,
  });

  // Resets search, selection, and the isClearingRead flag whenever the filter
  // changes (e.g. switching between unread and read tabs).
  useEffect(() => {
    setIsClearingRead(false);
    setSearch('');
    setDebouncedSearch('');
    setSelectedLinkIndex(null);
  }, [filter]);

  // Clamps selection when the list shrinks (e.g. after a link is marked as read).
  useEffect(() => {
    if (selectedLinkIndex !== null && selectedLinkIndex >= links.length) {
      setSelectedLinkIndex(links.length > 0 ? links.length - 1 : null);
    }
  }, [links.length, selectedLinkIndex]);

  // Resets selection when search changes, so the highlighted card matches the
  // new result set.
  useEffect(() => {
    setSelectedLinkIndex(null);
  }, [debouncedSearch]);

  /**
   * Triggers the card exit animation before calling `handleDeleteAllRead`.
   * `isClearingRead` is set to `true` immediately so `LinksList` can start
   * animating cards out, then cleared in `finally` regardless of success or
   * failure so the UI never gets stuck in the animating state.
   */
  async function handleClearRead() {
    setIsClearingRead(true);
    try {
      await handleDeleteAllRead();
    } finally {
      setIsClearingRead(false);
    }
  }

  return {
    debouncedSearch,
    deleteError,
    fetchError,
    filter,
    handleClearRead,
    handleCreated,
    handleDismissToast,
    handleLoadMore,
    handleRandom,
    handleToggleForm,
    handleToggleRead,
    isClearingRead,
    links,
    loadingLinks,
    newLinksAnnouncement,
    onCloseShortcuts: () => setShowShortcuts(false),
    onNavigateRead: () => navigate('/read'),
    onNavigateUnread: () => navigate('/unread'),
    onSearch: setSearch,
    onToggleShortcuts: () => setShowShortcuts((previous) => !previous),
    page,
    pagination,
    randomError,
    randomLoading,
    readError,
    saveError,
    search,
    searchInputReference,
    selectedLinkIndex,
    showLinkForm,
    showShortcuts,
    toastMessage,
  };
}
