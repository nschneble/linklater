import { lazy, Suspense, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useFocusReturn } from '../../lib/hooks/useFocusReturn';
import { useFocusTrap } from '../../lib/hooks/useFocusTrap';
import { useLinksView } from '../../lib/hooks/useLinksView';
import LinkForm from './LinkForm';
import LinksList from './LinksList';
import LinksToolbar from './LinksToolbar';
import Alert from '../common/Alert';
import Toast from '../common/Toast';

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
    <Alert
      className="mt-2 animate-fade-in-up"
      icon="fa-triangle-exclamation"
      variant="error"
    >
      {message}
    </Alert>
  );
}

// Lazy-loaded because the modal is rarely open and this keeps it out of the
// initial bundle.
const KeyboardShortcutsModal = lazy(() => import('./KeyboardShortcutsModal'));

interface LinksViewProps {
  onCloseUserMenu?: () => void;
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
export default function LinksView({ onCloseUserMenu }: LinksViewProps = {}) {
  const {
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
    onCloseShortcuts,
    onNavigateRead,
    onNavigateUnread,
    onSearch,
    onToggleShortcuts,
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
  } = useLinksView({ onCloseUserMenu });

  const dialogReference = useRef<HTMLDivElement>(null);

  useFocusTrap(dialogReference);
  useFocusReturn(showLinkForm);

  return (
    <>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-lg font-semibold">Your links</h1>
        <button
          type="button"
          className="hidden sm:inline-flex text-[var(--text-subtle)] hover:text-[var(--text)] transition-colors cursor-help"
          onClick={onToggleShortcuts}
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
        onNavigateRead={onNavigateRead}
        onNavigateUnread={onNavigateUnread}
        onRandom={handleRandom}
        onSearch={onSearch}
        onToggleForm={handleToggleForm}
      />

      <ViewError message={fetchError} />
      <ViewError message={randomError} />
      <ViewError message={saveError} />
      <ViewError message={readError} />
      <ViewError message={deleteError} />

      {showShortcuts && (
        <Suspense>
          <KeyboardShortcutsModal onClose={onCloseShortcuts} />
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
        <div
          id={LINK_FORM_ID}
          ref={dialogReference}
          role="dialog"
          aria-modal="true"
          aria-label="Save a link"
          tabIndex={-1}
          className="relative z-30 mt-0 animate-fade-in-up"
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
