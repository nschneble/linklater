import { updateMe } from './lib/api';
import { useAuth } from './auth/AuthContext';
import { useLinks } from './lib/useLinks';
import { useState } from 'react';
import { useTheme, type BaseTheme } from './theme/ThemeContext';

import Header from './components/Header';
import LinksView from './components/LinksView';
import SettingsView from './components/SettingsView';
import ThemeEditor from './components/ThemeEditor';
import Toast from './components/ui/Toast';

type AppView = 'links' | 'settings' | 'theme-editor';
type LinksFilter = 'active' | 'archived';

export default function AppShell() {
  const { logout, user } = useAuth();
  const { setBaseTheme, toggleMode } = useTheme();

  const [filter, setFilter] = useState<LinksFilter>('active');
  const [search, setSearch] = useState('');
  const [view, setView] = useState<AppView>('links');

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

  const handleModeToggle = () => {
    const nextMode = user?.mode === 'light' ? 'dark' : 'light';
    toggleMode();
    updateMe({ mode: nextMode }).catch((error) =>
      console.error('Failed to save mode', error),
    );
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <Header
        onLogout={logout}
        onModeToggle={handleModeToggle}
        onThemeSelect={handleThemeSelect}
        onViewChange={setView}
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
            onFilterChange={setFilter}
            onLoadMore={handleLoadMore}
            onRandom={handleRandom}
            onSearchChange={setSearch}
            onToggleForm={handleToggleForm}
            page={page}
            pagination={pagination}
            randomError={randomError}
            randomLoading={randomLoading}
            saveError={saveError}
            search={search}
            showLinkForm={showLinkForm}
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
