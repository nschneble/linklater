import IconButton from './ui/IconButton';
import LinkForm from './LinkForm';
import LinksList from './LinksList';
import PrimaryButton from './ui/PrimaryButton';
import TabButton from './ui/TabButton';
import Toast from './ui/Toast';
import { createPortal } from 'react-dom';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useKeyboardShortcuts } from '../lib/useKeyboardShortcuts';
import { useLinks } from '../lib/useLinks';
import { useLocation, useNavigate } from 'react-router-dom';
import type { LinksFilter } from '../lib/useLinks';

const SEARCH_DEBOUNCE_MS = 300;

const KeyboardShortcutsModal = lazy(() => import('./KeyboardShortcutsModal'));

function filterFromPath(pathname: string): LinksFilter {
  return pathname === '/read' ? 'archived' : 'active';
}

export default function LinksView() {
  const location = useLocation();
  const navigate = useNavigate();
  const filter = filterFromPath(location.pathname);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [isClearingArchived, setIsClearingArchived] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  const {
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

  useKeyboardShortcuts({
    enabled: true,
    isShortcutsModalOpen: showShortcuts,
    onShowUnread: () => navigate('/unread'),
    onShowRead: () => navigate('/read'),
    onSearch: () => searchInputRef.current?.focus(),
    onToggleForm: handleToggleForm,
    onStumble: handleRandom,
    onToggleShortcuts: () => setShowShortcuts((previous) => !previous),
  });

  useEffect(() => {
    setIsClearingArchived(false);
  }, [filter]);

  useEffect(() => {
    if (!showLinkForm) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        handleToggleForm();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showLinkForm, handleToggleForm]);

  async function handleClearArchived() {
    setIsClearingArchived(true);
    await new Promise<void>((resolve) => setTimeout(resolve, 400));
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
          className="text-[var(--text-subtle)] hover:text-[var(--text)] transition-colors cursor-pointer"
          onClick={() => setShowShortcuts((previous) => !previous)}
          aria-label="Show keyboard shortcuts"
          title="Keyboard shortcuts"
        >
          <i className="fa-regular fa-keyboard text-sm" aria-hidden="true" />
        </button>
      </div>
      <p className="text-[var(--text-muted)] text-xs">
        {filter === 'archived'
          ? 'Read links are automatically removed after 7 days.'
          : 'Add, search, or stumble upon something random.'}
      </p>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4">
        <div
          className="relative grid grid-cols-2 p-1 bg-[var(--bg-surface)] border-shadow hover:border-shadow text-xs rounded-full"
          role="tablist"
          aria-label="Links filter"
        >
          <div
            aria-hidden="true"
            className="absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] bg-[var(--text)] rounded-full"
            style={{
              transition: 'transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1)',
              transform:
                filter === 'archived' ? 'translateX(100%)' : 'translateX(0)',
            }}
          />
          <TabButton
            className="px-3 py-1.5"
            isActive={filter === 'active'}
            onClick={() => navigate('/unread')}
          >
            Unread
          </TabButton>
          <TabButton
            className="px-3 py-1.5"
            isActive={filter === 'archived'}
            onClick={() => navigate('/read')}
          >
            Read
          </TabButton>
        </div>

        {filter === 'active' && (
          <div className="flex items-end gap-3">
            <IconButton
              variant="elevated"
              disabled={randomLoading}
              title="Opens a random unread link and marks it as read."
              onClick={handleRandom}
            >
              <i
                className="fa-solid fa-shuffle text-[0.7rem]"
                aria-hidden="true"
              />
              {randomLoading ? 'Stumbling…' : 'Stumble upon'}
            </IconButton>

            <PrimaryButton
              type="button"
              onClick={handleToggleForm}
              aria-expanded={showLinkForm}
            >
              <i
                className="fa-solid fa-plus text-[0.7rem]"
                aria-hidden="true"
              />
              {showLinkForm ? 'Hide form' : 'Add link'}
            </PrimaryButton>
          </div>
        )}

        {filter === 'archived' && links.length > 0 && (
          <div className="flex items-end gap-3">
            <IconButton
              variant="elevated"
              disabled={isClearingArchived}
              title="Permanently removes all read links."
              onClick={handleClearArchived}
            >
              <i
                className="fa-solid fa-trash text-[0.7rem]"
                aria-hidden="true"
              />
              Remove all read
            </IconButton>
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4 mb-3">
        <input
          ref={searchInputRef}
          className="w-full px-3 py-2 bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text)] text-sm placeholder:text-[var(--text-subtle)] focus:outline-none focus:ring focus:ring-[var(--accent)] focus:border-[var(--accent)] rounded-lg"
          type="search"
          placeholder={
            filter === 'active' ? 'Search unread links' : 'Search read links'
          }
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.currentTarget.blur();
            }
          }}
          aria-label="Search through your links"
        />
      </div>

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

      {showShortcuts && (
        <Suspense>
          <KeyboardShortcutsModal onClose={() => setShowShortcuts(false)} />
        </Suspense>
      )}

      {showLinkForm &&
        createPortal(
          <div
            className="fixed inset-0 z-20 bg-black/50 backdrop-blur-sm"
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
        onArchiveToggle={handleToggleArchive}
        onLoadMore={handleLoadMore}
      />

      {toastMessage && (
        <Toast message={toastMessage} onDismiss={handleDismissToast} />
      )}
    </>
  );
}
