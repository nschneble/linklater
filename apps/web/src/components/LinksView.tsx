import LinkForm from './LinkForm';
import LinksList from './LinksList';
import LinksToolbar from './LinksToolbar';
import Toast from './ui/Toast';
import { createPortal } from 'react-dom';
import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  useTransition,
} from 'react';
import { useKeyboardShortcuts } from '../lib/useKeyboardShortcuts';
import { useLinks } from '../lib/useLinks';
import { useLocation, useNavigate } from 'react-router-dom';
import type { LinksFilter } from '../lib/useLinks';

/** How long to wait after the user stops typing before firing the search request. */
const SEARCH_DEBOUNCE_MS = 300;

// Lazy-loaded because the modal is rarely open and this keeps it out of the
// initial bundle.
const KeyboardShortcutsModal = lazy(() => import('./KeyboardShortcutsModal'));

/**
 * Maps the current URL pathname to the links filter.
 * `/read` → `'archived'`, everything else → `'active'`.
 */
function filterFromPath(pathname: string): LinksFilter {
  return pathname === '/read' ? 'archived' : 'active';
}

/**
 * The main links view, rendered inside `AppShell` for both `/unread` and `/read`.
 *
 * Responsibilities:
 * - Reads the active filter from the URL (`/unread` vs `/read`).
 * - Debounces the search input (300ms) and wraps the `setDebouncedSearch` call
 *   in `startTransition` so that React can defer the expensive re-render.
 * - Wires up keyboard shortcuts via `useKeyboardShortcuts`.
 * - Renders `LinksToolbar`, `LinksList`, the inline `LinkForm`, and a success
 *   `Toast`.
 * - Portals a backdrop `<button>` when the link form is open so that clicking
 *   outside the form closes it.
 * - Resets search and the `isClearingArchived` flag whenever the filter changes.
 */
export default function LinksView() {
  const location = useLocation();
  const navigate = useNavigate();
  const filter = filterFromPath(location.pathname);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedLinkIndex, setSelectedLinkIndex] = useState<number | null>(
    null,
  );
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [isClearingArchived, setIsClearingArchived] = useState(false);
  const [, startTransition] = useTransition();
  const searchInputRef = useRef<HTMLInputElement>(null);

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
    archiveError,
    deleteError,
    handleCreated,
    handleDeleteAllArchived,
    handleDismissToast,
    handleLoadMore,
    handleRandom,
    handleToggleArchive,
    handleToggleForm,
    links,
    loadingLinks,
    page,
    pagination,
    randomError,
    randomLoading,
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
      handleToggleArchive(link);
    }
  }

  useKeyboardShortcuts({
    enabled: true,
    isShortcutsModalOpen: showShortcuts,
    onShowUnread: () => navigate('/unread'),
    onShowRead: () => navigate('/read'),
    onSearch: () => searchInputRef.current?.focus(),
    onToggleForm: handleToggleForm,
    onStumble: handleRandom,
    onToggleShortcuts: () => setShowShortcuts((previous) => !previous),
    onEscape: showLinkForm ? handleToggleForm : undefined,
    onNavigateNextLink: handleNavigateNextLink,
    onNavigatePrevLink: handleNavigatePrevLink,
    onOpenSelectedLink: handleOpenSelectedLink,
  });

  useEffect(() => {
    setIsClearingArchived(false);
    setSearch('');
    setDebouncedSearch('');
    setSelectedLinkIndex(null);
  }, [filter]);

  // clamps selection when the list shrinks (like after a link is archived)
  useEffect(() => {
    if (selectedLinkIndex !== null && selectedLinkIndex >= links.length) {
      setSelectedLinkIndex(links.length > 0 ? links.length - 1 : null);
    }
  }, [links.length, selectedLinkIndex]);

  // resets selection when search changes, so the highlighted card matches
  useEffect(() => {
    setSelectedLinkIndex(null);
  }, [debouncedSearch]);

  async function handleClearArchived() {
    setIsClearingArchived(true);
    try {
      await handleDeleteAllArchived();
    } finally {
      setIsClearingArchived(false);
    }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-semibold">Your links</h2>
        <button
          type="button"
          className="text-[var(--text-subtle)] hover:text-[var(--text)] transition-colors cursor-help"
          onClick={() => setShowShortcuts((previous) => !previous)}
          aria-label="Show keyboard shortcuts"
          title="Keyboard shortcuts"
        >
          <i className="fa-regular fa-keyboard text-sm" aria-hidden="true" />
        </button>
      </div>
      <p className="text-[var(--text-muted)] text-xs">
        {filter === 'archived'
          ? 'Read links are automatically removed after seven days.'
          : 'Add, search, or stumble upon something random.'}
      </p>

      <LinksToolbar
        filter={filter}
        isClearingArchived={isClearingArchived}
        links={links}
        randomLoading={randomLoading}
        search={search}
        searchInputRef={searchInputRef}
        showLinkForm={showLinkForm}
        onClearArchived={handleClearArchived}
        onNavigateRead={() => navigate('/read')}
        onNavigateUnread={() => navigate('/unread')}
        onRandom={handleRandom}
        onSearch={setSearch}
        onToggleForm={handleToggleForm}
      />

      {randomError && (
        <p
          className="mt-2 text-rose-300 text-xs animate-fade-in-up"
          role="alert"
        >
          {randomError}
        </p>
      )}

      {saveError && (
        <p
          className="mt-2 text-rose-300 text-xs animate-fade-in-up"
          role="alert"
        >
          {saveError}
        </p>
      )}

      {archiveError && (
        <p
          className="mt-2 text-rose-300 text-xs animate-fade-in-up"
          role="alert"
        >
          {archiveError}
        </p>
      )}

      {deleteError && (
        <p
          className="mt-2 text-rose-300 text-xs animate-fade-in-up"
          role="alert"
        >
          {deleteError}
        </p>
      )}

      {showShortcuts && (
        <Suspense>
          <KeyboardShortcutsModal onClose={() => setShowShortcuts(false)} />
        </Suspense>
      )}

      {showLinkForm &&
        createPortal(
          <button
            type="button"
            aria-label="Close form"
            className="fixed inset-0 z-20 w-full h-full bg-black/50 backdrop-blur-sm cursor-default"
            onClick={handleToggleForm}
          />,
          document.body,
        )}

      {showLinkForm && (
        <div className="relative z-30 mt-0 animate-fade-in-up">
          <LinkForm onCreated={handleCreated} />
        </div>
      )}

      <LinksList
        filter={filter}
        isClearingArchived={isClearingArchived}
        links={links}
        loadingLinks={loadingLinks}
        page={page}
        pagination={pagination}
        search={search}
        debouncedSearch={debouncedSearch}
        selectedLinkIndex={selectedLinkIndex}
        onArchiveToggle={handleToggleArchive}
        onLoadMore={handleLoadMore}
      />

      {toastMessage && (
        <Toast message={toastMessage} onDismiss={handleDismissToast} />
      )}
    </>
  );
}
