import { updateMe } from './lib/api';
import { useAuth } from './auth/AuthContext';
import { useKeyboardShortcuts } from './lib/useKeyboardShortcuts';
import { useLinks } from './lib/useLinks';
import { useLocation, useNavigate } from 'react-router-dom';
import { useRef, useState } from 'react';
import { useTheme, type BaseTheme } from './theme/ThemeContext';

import Header from './components/Header';
import LinksView from './components/LinksView';
import SettingsView from './components/SettingsView';
import ThemeEditor from './components/ThemeEditor';
import Toast from './components/ui/Toast';

type AppView = 'links' | 'settings' | 'theme-editor';
type LinksFilter = 'active' | 'archived';

function viewFromPath(pathname: string): AppView {
  if (pathname === '/settings') return 'settings';
  if (pathname === '/editor') return 'theme-editor';
  return 'links';
}

function filterFromPath(pathname: string): LinksFilter {
  if (pathname === '/read') {
    return 'archived';
  }
  return 'active';
}

export default function AppShell() {
  const { logout, user } = useAuth();
  const { setBaseTheme, toggleMode } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  const searchInputRef = useRef<HTMLInputElement>(null);

  const view = viewFromPath(location.pathname);
  const filter = filterFromPath(location.pathname);

  const [search, setSearch] = useState('');
  const [showShortcuts, setShowShortcuts] = useState(false);

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
  } = useLinks(filter, search);

  const handleThemeSelect = (theme: BaseTheme) => {
    setBaseTheme(theme);
    updateMe({ theme }).catch((error) =>
      console.error('Failed to save theme', error),
    );
  };

  function handleSearch() {
    searchInputRef.current?.focus();
  }

  useKeyboardShortcuts({
    enabled: view === 'links',
    isShortcutsModalOpen: showShortcuts,
    onShowUnread: () => navigate('/unread'),
    onShowRead: () => navigate('/read'),
    onSearch: handleSearch,
    onToggleForm: handleToggleForm,
    onStumble: handleRandom,
    onToggleShortcuts: () => setShowShortcuts((previous) => !previous),
  });

  const handleModeToggle = () => {
    const nextMode = user?.mode === 'light' ? 'dark' : 'light';
    toggleMode();
    updateMe({ mode: nextMode }).catch((error) =>
      console.error('Failed to save mode', error),
    );
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] select-none">
      <Header
        onLogout={logout}
        onModeToggle={handleModeToggle}
        onThemeSelect={handleThemeSelect}
        onViewChange={(newView) => {
          if (newView === 'links') navigate('/unread');
          else if (newView === 'settings') navigate('/settings');
          else navigate('/editor');
        }}
        user={user}
        view={view}
      />

      <main
        className={
          view === 'theme-editor'
            ? 'px-4 py-8'
            : 'max-w-3xl mx-auto px-4 py-12 space-y-6'
        }
      >
        {view === 'links' ? (
          <LinksView
            filter={filter}
            links={links}
            loadingLinks={loadingLinks}
            onArchiveToggle={handleToggleArchive}
            onCreated={handleCreated}
            onDeleteAllArchived={handleDeleteAllArchived}
            onFilterChange={(newFilter) => {
              if (newFilter === 'active') {
                navigate('/unread');
              } else {
                navigate('/read');
              }
            }}
            onLoadMore={handleLoadMore}
            onRandom={handleRandom}
            onSearchChange={setSearch}
            searchInputRef={searchInputRef}
            onToggleShortcuts={() => setShowShortcuts((previous) => !previous)}
            onToggleForm={handleToggleForm}
            page={page}
            pagination={pagination}
            randomError={randomError}
            randomLoading={randomLoading}
            saveError={saveError}
            search={search}
            showLinkForm={showLinkForm}
            showShortcuts={showShortcuts}
          />
        ) : view === 'theme-editor' ? (
          <ThemeEditor />
        ) : (
          <SettingsView />
        )}
      </main>
      {toastMessage && (
        <Toast message={toastMessage} onDismiss={handleDismissToast} />
      )}
    </div>
  );
}
