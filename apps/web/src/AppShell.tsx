import { updateMe } from './lib/api';
import { useAuth } from './auth/AuthContext';
import { useLinks } from './lib/useLinks';
import { useState } from 'react';
import { useTheme, type BaseTheme } from './theme/ThemeContext';

import Header from './components/Header';
import LinksView from './components/LinksView';
import SettingsView from './components/SettingsView';

type AppView = 'links' | 'settings';
type LinksFilter = 'active' | 'archived';

export default function AppShell() {
  const { logout, user } = useAuth();
  const { setBaseTheme, toggleMode } = useTheme();

  const [filter, setFilter] = useState<LinksFilter>('active');
  const [search, setSearch] = useState('');
  const [view, setView] = useState<AppView>('links');

  const {
    handleCreated,
    handleDelete,
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
    showLinkForm,
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

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {view === 'links' ? (
          <LinksView
            filter={filter}
            links={links}
            loadingLinks={loadingLinks}
            onArchiveToggle={handleToggleArchive}
            onCreated={handleCreated}
            onDelete={handleDelete}
            onFilterChange={setFilter}
            onLoadMore={handleLoadMore}
            onRandom={handleRandom}
            onSearchChange={setSearch}
            onToggleForm={handleToggleForm}
            page={page}
            pagination={pagination}
            randomError={randomError}
            randomLoading={randomLoading}
            search={search}
            showLinkForm={showLinkForm}
          />
        ) : (
          <SettingsView />
        )}
      </main>
    </div>
  );
}
