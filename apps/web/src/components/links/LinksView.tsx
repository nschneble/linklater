import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  useTransition,
} from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { useKeyboardShortcuts } from '../../lib/hooks/useKeyboardShortcuts';
import { useLinks, type LinksFilter } from '../../lib/hooks/useLinks';
import LinkForm from './LinkForm';
import LinksList from './LinksList';
import LinksToolbar from './LinksToolbar';
import Toast from '../common/Toast';

/**
 * How long to wait after the user stops typing before firing the search
 * request.
 */
const SEARCH_DEBOUNCE_MS = 300;

/**
 * Stable `id` for the link form container, referenced by the toggle
 * button's `aria-controls`.
 */
export const LINK_FORM_ID = 'link-form-container';

/**
 * Renders an inline error message when `message` is non-null. Used for the
 * four separate error states in `LinksView` (save, read, random, delete).
 */
function ViewError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="mt-2 text-rose-300 text-xs animate-fade-in-up" role="alert">
      {message}
    </p>
  );
}

// Lazy-loaded because the modal is rarely open and this keeps it out of the
// initial bundle.
const KeyboardShortcutsModal = lazy(() => import('./KeyboardShortcutsModal'));

/**
 * Maps the current URL pathname to the links filter.
 * `/read` → `'read'`, everything else → `'unread'`.
 */
function filterFromPath(pathname: string): LinksFilter {
  return pathname === '/read' ? 'read' : 'unread';
}

/**
 * The main links view, rendered inside `AppShell` for both `/unread` and `/read`.
 *
 * Responsibilities:
 * - Reads the current filter from the URL (`/unread` vs `/read`).
 * - Debounces the search input (300ms) and wraps the `setDebouncedSearch` call
 *   in `startTransition` so that React can defer the expensive re-render.
 * - Wires up keyboard shortcuts via `useKeyboardShortcuts`.
 * - Renders `LinksToolbar`, `LinksList`, the inline `LinkForm`, and a success
 *   `Toast`.
 * - Portals a backdrop `<button>` when the link form is open so that clicking
 *   outside the form closes it.
 * - Resets search and the `isClearingRead` flag whenever the filter changes.
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
  const [isClearingRead, setIsClearingRead] = useState(false);
  const [, startTransition] = useTransition();
  const searchInputReference = useRef<HTMLInputElement>(null);

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
    fetchError,
    readError,
    deleteError,
    handleCreated,
    handleDeleteAllRead,
    handleDismissToast,
    handleLoadMore,
    handleRandom,
    handleToggleRead,
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

  /**
   * Moves keyboard selection one step down the link list, clamping at
   * the last card. If nothing is selected yet, selects the first card.
   */
  function handleNavigateNextLink() {
    if (links.length === 0) return;
    setSelectedLinkIndex((previous) => {
      if (previous === null) return 0;
      return Math.min(previous + 1, links.length - 1);
    });
  }

  /**
   * Moves keyboard selection one step up the link list, clamping at
   * the first card. If nothing is selected yet, selects the last card.
   */
  function handleNavigatePrevLink() {
    if (links.length === 0) return;
    setSelectedLinkIndex((previous) => {
      if (previous === null) return links.length - 1;
      return Math.max(previous - 1, 0);
    });
  }

  /**
   * Opens the keyboard-selected link in a new tab and marks it as read
   * if it hasn't been read yet. A no-op when no card is selected.
   */
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

  useEffect(() => {
    setIsClearingRead(false);
    setSearch('');
    setDebouncedSearch('');
    setSelectedLinkIndex(null);
  }, [filter]);

  // clamps selection when the list shrinks (e.g. after a link is marked as read)
  useEffect(() => {
    if (selectedLinkIndex !== null && selectedLinkIndex >= links.length) {
      setSelectedLinkIndex(links.length > 0 ? links.length - 1 : null);
    }
  }, [links.length, selectedLinkIndex]);

  // resets selection when search changes, so the highlighted card matches
  useEffect(() => {
    setSelectedLinkIndex(null);
  }, [debouncedSearch]);

  /**
   * Triggers the card exit animation before calling `handleDeleteAllRead`.
   * `isClearingRead` is set to `true` immediately so `LinksList` can start
   * animating cards out, then cleared in `finally` regardless of success
   * or failure so the UI never gets stuck in the animating state.
   */
  async function handleClearRead() {
    setIsClearingRead(true);
    try {
      await handleDeleteAllRead();
    } finally {
      setIsClearingRead(false);
    }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-lg font-semibold">Your links</h1>
        <button
          type="button"
          className="hidden sm:inline-flex text-[var(--text-subtle)] hover:text-[var(--text)] transition-colors cursor-help"
          onClick={() => setShowShortcuts((previous) => !previous)}
          aria-label="Show keyboard shortcuts"
          title="Keyboard shortcuts"
        >
          <i className="fa-solid fa-keyboard text-sm" aria-hidden="true" />
        </button>
      </div>
      <p className="text-[var(--text-muted)] text-xs">
        <span className="hidden sm:inline-flex">
          {filter === 'read'
            ? 'Read links are automatically removed after seven days.'
            : 'Add, search, or stumble upon something random.'}
        </span>
        <span className="inline-flex sm:hidden">
          {filter === 'read'
            ? 'Read links are removed after 7 days.'
            : 'Add, search, or stumble!'}
        </span>
      </p>

      <LinksToolbar
        filter={filter}
        isClearingRead={isClearingRead}
        links={links}
        randomLoading={randomLoading}
        search={search}
        searchInputReference={searchInputReference}
        showLinkForm={showLinkForm}
        onClearRead={handleClearRead}
        onNavigateRead={() => navigate('/read')}
        onNavigateUnread={() => navigate('/unread')}
        onRandom={handleRandom}
        onSearch={setSearch}
        onToggleForm={handleToggleForm}
      />

      <ViewError message={fetchError} />
      <ViewError message={randomError} />
      <ViewError message={saveError} />
      <ViewError message={readError} />
      <ViewError message={deleteError} />

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
        // NOTE: a <div role="dialog"> with a manual focus trap is used
        // here rather than the native <dialog> element because <dialog>
        // requires an imperative showModal() / close() call and does not
        // integrate cleanly with React's conditional-render pattern. The
        // manual Tab-wrap below replicates the behavior required by the
        // ARIA dialog pattern: Tab wraps forward to the first focusable
        // element, Shift+Tab wraps back to the last.
        //
        // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- role="dialog" is interactive per ARIA spec; jsx-a11y incorrectly classifies it as non-interactive
        <div
          id={LINK_FORM_ID}
          role="dialog"
          aria-modal="true"
          aria-label="Save a link"
          tabIndex={-1}
          className="relative z-30 mt-0 animate-fade-in-up"
          onKeyDown={(event) => {
            if (event.key !== 'Tab') return;
            const dialog = event.currentTarget;
            const focusable = dialog.querySelectorAll<HTMLElement>(
              'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
            );
            if (focusable.length === 0) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey) {
              if (document.activeElement === first) {
                event.preventDefault();
                last.focus();
              }
            } else {
              if (document.activeElement === last) {
                event.preventDefault();
                first.focus();
              }
            }
          }}
        >
          <LinkForm onCreated={handleCreated} />
        </div>
      )}

      <LinksList
        filter={filter}
        isClearingRead={isClearingRead}
        links={links}
        loadingLinks={loadingLinks}
        page={page}
        pagination={pagination}
        search={search}
        debouncedSearch={debouncedSearch}
        selectedLinkIndex={selectedLinkIndex}
        onReadToggle={handleToggleRead}
        onLoadMore={handleLoadMore}
      />

      {toastMessage && (
        <Toast message={toastMessage} onDismiss={handleDismissToast} />
      )}
    </>
  );
}
