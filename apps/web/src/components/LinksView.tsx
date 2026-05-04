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
  const [, startTransition] = useTransition();
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(
      () => startTransition(() => setDebouncedSearch(search)),
      SEARCH_DEBOUNCE_MS,
    );
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
    onEscape: showLinkForm ? handleToggleForm : undefined,
  });

  useEffect(() => {
    setIsClearingArchived(false);
  }, [filter]);

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
        onArchiveToggle={handleToggleArchive}
        onLoadMore={handleLoadMore}
      />

      {toastMessage && (
        <Toast message={toastMessage} onDismiss={handleDismissToast} />
      )}
    </>
  );
}
