import { useFocusReturn } from '../../lib/hooks/useFocusReturn';
import { useFocusTrap } from '../../lib/hooks/useFocusTrap';
import { useDocumentTitle } from '../../lib/hooks/useDocumentTitle';
import { useLinksView } from '../../lib/hooks/useLinksView';
import { usePendingNotice } from '../../lib/hooks/usePendingNotice';
import { FOCUS_RING } from '../../lib/styles';
import Alert from '../common/Alert';
import PendingNoticeAnnouncer from '../common/PendingNoticeAnnouncer';
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
 *
 * Cross-route pending notices (FLAG-1) – e.g. arriving on /unread after a
 * verify-email redirect – are consumed via `usePendingNotice` and surfaced
 * by `PendingNoticeAnnouncer` (toast + sr-only mirror). The announcer IS
 * the announcement; no focus shift to the <main> landmark is performed on
 * notice arrival, since (a) NVDA/JAWS can interrupt a polite live region
 * when focus moves into an unrelated landmark mid-announce, and (b) the
 * <main> landmark already carries `aria-label="Links"` in AppShell so
 * keyboard users get a named landing point via the existing skip link.
 */
export default function LinksView({ onCloseUserMenu }: LinksViewProps = {}) {
  const view = useLinksView({ onCloseUserMenu });
  const pendingNotice = usePendingNotice();

  useDocumentTitle(
    view.filter === 'unread'
      ? 'Linklater – Your links'
      : 'Linklater – Read links',
  );

  const dialogReference = useRef<HTMLDivElement>(null);

  useFocusTrap(dialogReference);
  useFocusReturn(view.showLinkForm);

  return (
    <>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-lg font-semibold">Your links</h1>
        <button
          type="button"
          className="hidden sm:inline-flex text-[var(--base-subtle-text)] hover:text-[var(--base-text)] transition-colors cursor-help"
          onClick={view.onToggleShortcuts}
          aria-label="Show keyboard shortcuts"
          title="Keyboard shortcuts"
        >
          <i className="fa-solid fa-keyboard text-sm" aria-hidden="true" />
        </button>
      </div>
      <p className="text-[var(--base-alt-text)] text-xs">
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
          // Redundant mouse-only dismiss affordance. Hidden from assistive
          // tech (aria-hidden + tabIndex -1) now that the dialog carries a
          // keyboard-reachable Close button; keyboard dismissal is covered by
          // Escape (useKeyboardShortcuts) and that button.
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            className="fixed inset-0 z-20 w-full h-full scrim backdrop-blur-sm cursor-default"
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
          aria-labelledby="save-link-heading"
          tabIndex={-1}
          className="fixed sm:relative inset-x-4 sm:inset-x-auto top-16 sm:top-auto z-30 max-h-[calc(100dvh-5rem)] sm:max-h-none overflow-y-auto sm:overflow-visible sm:mt-0 p-4 bg-[var(--base-bg)] border border-[var(--base-border)] rounded-2xl shadow-lg animate-fade-in-up"
        >
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2
              id="save-link-heading"
              className="text-[var(--base-text)] text-base font-semibold"
            >
              Save a link
            </h2>
            <button
              type="button"
              aria-label="Close"
              className={`flex items-center justify-center w-11 h-11 -mr-2 text-[var(--base-alt-text)] hover:text-[var(--base-text)] active:scale-[0.96] transition-colors cursor-pointer rounded-full ${FOCUS_RING}`}
              onClick={view.handleToggleForm}
            >
              <i className="fa-solid fa-xmark text-sm" aria-hidden="true" />
            </button>
          </div>

          <LinkForm onCreated={view.handleCreated} />
        </div>
      )}

      <LinksList
        filter={view.filter}
        hasSettledOnce={view.hasSettledOnce}
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
        The visual Toast above already carries its own role="status"
        aria-live="polite", so it is not echoed here – that produced a
        double SR announcement.
      */}
      <span className="sr-only" role="status">
        {view.newLinksAnnouncement}
      </span>

      {/*
        Cross-route pending-notice surface (FLAG-1). Separate from
        view.toastMessage above, which handles in-session events like
        "Link saved!". This surfaces messages queued by another flow
        (e.g. account-deleted, email-verified) when this view is the
        first mount after the redirect.
      */}
      <PendingNoticeAnnouncer
        notice={pendingNotice.notice}
        variant={pendingNotice.variant}
        onDismiss={pendingNotice.dismiss}
      />
    </>
  );
}
