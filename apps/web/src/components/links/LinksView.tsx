import { useFocusReturn } from '../../lib/hooks/useFocusReturn';
import { useFocusTrap } from '../../lib/hooks/useFocusTrap';
import { useLinksView } from '../../lib/hooks/useLinksView';
import Alert from '../common/Alert';
import Toast from '../common/Toast';
import LinkForm from './LinkForm';
import LinksList from './LinksList';
import LinksToolbar from './LinksToolbar';
import { LINK_FORM_ID } from './constants';
import { lazy, Suspense, useRef } from 'react';
import { createPortal } from 'react-dom';

/**
 * Renders an inline error message when `message` is non-null. Used for the
 * five separate error states surfaced by `useLinksView` (save, read, random,
 * delete, fetch).
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
  const view = useLinksView({ onCloseUserMenu });

  const dialogReference = useRef<HTMLDivElement>(null);

  useFocusTrap(dialogReference);
  useFocusReturn(view.showLinkForm);

  return (
    <>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-lg font-semibold">Your links</h1>
        <button
          type="button"
          className="hidden sm:inline-flex text-[var(--text-subtle)] hover:text-[var(--text)] transition-colors cursor-help"
          onClick={view.onToggleShortcuts}
          aria-label="Show keyboard shortcuts"
          title="Keyboard shortcuts"
        >
          <i className="fa-solid fa-keyboard text-sm" aria-hidden="true" />
        </button>
      </div>
      <p className="text-[var(--text-muted)] text-xs">
        <span className="hidden sm:inline-flex">
          {view.filter === 'read'
            ? 'Read links are automatically removed after seven days.'
            : 'Add, search, or stumble upon something random.'}
        </span>
        <span className="inline-flex sm:hidden">
          {view.filter === 'read'
            ? 'Read links are removed after 7 days.'
            : 'Add, search, or stumble!'}
        </span>
      </p>

      <LinksToolbar
        filter={view.filter}
        isClearingRead={view.isClearingRead}
        links={view.links}
        randomLoading={view.randomLoading}
        search={view.search}
        searchInputReference={view.searchInputReference}
        showLinkForm={view.showLinkForm}
        onClearRead={view.handleClearRead}
        onNavigateRead={view.onNavigateRead}
        onNavigateUnread={view.onNavigateUnread}
        onRandom={view.handleRandom}
        onSearch={view.onSearch}
        onToggleForm={view.handleToggleForm}
      />

      <ViewError message={view.error} />

      {view.showShortcuts && (
        <Suspense>
          <KeyboardShortcutsModal onClose={view.onCloseShortcuts} />
        </Suspense>
      )}

      {view.showLinkForm &&
        createPortal(
          <button
            type="button"
            aria-label="Close form"
            className="fixed inset-0 z-20 w-full h-full bg-black/50 backdrop-blur-sm cursor-default"
            onClick={view.handleToggleForm}
          />,
          document.body,
        )}

      {view.showLinkForm && (
        <div
          id={LINK_FORM_ID}
          ref={dialogReference}
          role="dialog"
          aria-modal="true"
          aria-label="Save a link"
          tabIndex={-1}
          className="relative z-30 mt-0 animate-fade-in-up"
        >
          <LinkForm onCreated={view.handleCreated} />
        </div>
      )}

      <LinksList
        filter={view.filter}
        isClearingRead={view.isClearingRead}
        links={view.links}
        loadingLinks={view.loadingLinks}
        page={view.page}
        pagination={view.pagination}
        search={view.search}
        debouncedSearch={view.debouncedSearch}
        selectedLinkIndex={view.selectedLinkIndex}
        onReadToggle={view.handleToggleRead}
        onLoadMore={view.handleLoadMore}
      />

      {view.toastMessage && (
        <Toast
          message={view.toastMessage}
          onDismiss={view.handleDismissToast}
        />
      )}

      {/*
        Polite live region announcing links that arrive via a background
        visibility refresh (e.g. saved via the bookmarklet on another tab).
        The visible list is updated regardless; this is purely for screen
        reader users who don't see the prepend.
      */}
      <span className="sr-only" role="status">
        {view.newLinksAnnouncement}
      </span>
    </>
  );
}
