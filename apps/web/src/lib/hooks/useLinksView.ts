import { filterFromPath } from './useLinksView.utils';
import { useAggregatedError } from './useAggregatedError';
import { useEffect, useRef, useState } from 'react';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';
import { useLinks } from './useLinks';
import { useLinkSelection } from './useLinkSelection';
import { useLocation, useNavigate } from 'react-router';
import { useSearchDebounce } from './useSearchDebounce';
import { useShortcutsEnabled } from './useShortcutsEnabled';
import type { UseLinksViewResult } from './useLinksView.types';

export { filterFromPath } from './useLinksView.utils';
export type { UseLinksViewResult } from './useLinksView.types';

interface UseLinksViewOptions {
  /**
   * Called when the keyboard shortcuts modal opens, so the parent can close
   * any other menus (e.g. the user menu).
   */
  onCloseUserMenu?: () => void;
  /**
   * Called whenever the inline save-link dialog's open state changes, so
   * `AppShell` can `inert` its own chrome (Header, verification banner, skip
   * link) that sits outside the dialog's subtree while it is open. The
   * cleanup fires `false` on unmount so navigating away (which swaps out
   * `LinksView`) never leaves that chrome stuck inert.
   */
  onLinkFormOpenChange?: (isOpen: boolean) => void;
}

/**
 * Controller hook for `LinksView`. Composes the focused sub-hooks that own
 * each slice of state: the URL-derived filter, search debounce
 * (`useSearchDebounce`), keyboard selection (`useLinkSelection`), and the
 * aggregated error (`useAggregatedError`). Wires up keyboard shortcuts and
 * re-exposes a single, stable API. The shortcuts modal flag and the
 * clear-read animation flag stay here because they are small and coupled to
 * this hook's wiring.
 *
 * What stays in the view:
 * - `dialogReference`: attached to a JSX element and consumed directly by
 *   `useFocusTrap`; threading it through the hook would add complexity with
 *   no benefit.
 * - `useFocusTrap` + `useFocusReturn`: one-liner DOM hooks that sit next to
 *   their respective refs in the JSX.
 */
export function useLinksView({
  onCloseUserMenu,
  onLinkFormOpenChange,
}: UseLinksViewOptions = {}): UseLinksViewResult {
  const location = useLocation();
  const navigate = useNavigate();
  const filter = filterFromPath(location.pathname);

  const [showShortcuts, setShowShortcuts] = useState(false);
  const [isClearingRead, setIsClearingRead] = useState(false);
  const searchInputReference = useRef<HTMLInputElement>(null);
  const shortcutsEnabled = useShortcutsEnabled();

  useEffect(() => {
    if (showShortcuts) onCloseUserMenu?.();
  }, [showShortcuts, onCloseUserMenu]);

  // a stuck flag leaves cards and the clear control unusable (WCAG 2.1.1)
  useEffect(() => {
    setIsClearingRead(false);
  }, [filter]);

  const { search, debouncedSearch, setSearch } = useSearchDebounce(filter);
  const linksResult = useLinks(filter, debouncedSearch);

  useEffect(() => {
    onLinkFormOpenChange?.(linksResult.showLinkForm);
    return () => onLinkFormOpenChange?.(false);
  }, [linksResult.showLinkForm, onLinkFormOpenChange]);

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
    // WCAG 2.1.4 covers single-key shortcuts; named keys stay live
    singleKeyShortcutsEnabled: shortcutsEnabled,
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
