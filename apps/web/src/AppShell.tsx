import { useEffect, useState } from 'react';
import { useAuth } from './auth/AuthContext';
import { useTheme, type BaseTheme } from './theme/ThemeContext';
import {
  getLinks,
  archiveLink,
  unarchiveLink,
  deleteLink,
  getRandomLink,
  updateMe,
  type Link,
  type PaginatedLinks,
} from './lib/api';
import { useMetadataPolling } from './lib/useMetadataPolling';
import Header from './components/Header';
import LinksView from './components/LinksView';
import SettingsView from './components/SettingsView';

type AppView = 'links' | 'settings';
type LinksFilter = 'active' | 'archived';

export default function AppShell() {
  const { user, logout } = useAuth();
  const { setBaseTheme, toggleMode } = useTheme();

  const [view, setView] = useState<AppView>('links');
  const [links, setLinks] = useState<Link[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<LinksFilter>('active');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<Pick<PaginatedLinks, 'total' | 'limit'> | null>(null);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [randomLoading, setRandomLoading] = useState(false);
  const [randomError, setRandomError] = useState<string | null>(null);
  const [pendingMetaLinkId, setPendingMetaLinkId] = useState<string | null>(null);

  useMetadataPolling(pendingMetaLinkId, (updatedLink) => {
    setLinks((prev) => prev.map((l) => (l.id === updatedLink.id ? updatedLink : l)));
    setPendingMetaLinkId(null);
  });

  // Reset to page 1 when search or filter changes
  useEffect(() => {
    setPage(1);
  }, [search, filter]);

  // Load links when search/filter/page changes
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoadingLinks(true);
      try {
        const result = await getLinks({
          search: search || undefined,
          archived: filter === 'archived',
          page,
        });
        if (!cancelled) {
          if (page === 1) {
            setLinks(result.data);
          } else {
            setLinks((prev) => [...prev, ...result.data]);
          }
          setPagination({ total: result.total, limit: result.limit });
        }
      } catch (error) {
        console.error('Failed to load links', error);
      } finally {
        if (!cancelled) setLoadingLinks(false);
      }
    };

    const timeout = setTimeout(load, 200);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [search, filter, page]);

  const handleCreated = (link: Link) => {
    // New links are always active; only prepend when viewing active links
    if (filter === 'archived') {
      setShowLinkForm(false);
      return;
    }
    setLinks((prev) => [link, ...prev]);
    setShowLinkForm(false);
    setPendingMetaLinkId(link.id);
  };

  const handleToggleArchive = async (link: Link) => {
    try {
      const updated = link.archivedAt
        ? await unarchiveLink(link.id)
        : await archiveLink(link.id);

      setLinks((prev) => {
        if (filter === 'active' && updated.archivedAt) {
          return prev.filter((l) => l.id !== link.id);
        }
        if (filter === 'archived' && !updated.archivedAt) {
          return prev.filter((l) => l.id !== link.id);
        }
        return prev.map((l) => (l.id === link.id ? updated : l));
      });
    } catch (error: unknown) {
      console.error('Failed to toggle archive state', error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteLink(id);
      setLinks((prev) => prev.filter((l) => l.id !== id));
    } catch (error: unknown) {
      console.error('Failed to delete link', error);
    }
  };

  const handleRandom = async () => {
    setRandomError(null);
    setRandomLoading(true);
    try {
      const { link } = await getRandomLink({ archived: filter === 'archived' });
      if (!link) {
        setRandomError('No links available to randomize');
      } else {
        window.open(link.url, '_blank', 'noopener,noreferrer');
      }
    } catch (error: unknown) {
      setRandomError('Failed to get a random link');
      console.error('Failed to get a random link', error);
    } finally {
      setRandomLoading(false);
    }
  };

  const handleThemeSelect = (theme: BaseTheme) => {
    setBaseTheme(theme);
    updateMe({ theme }).catch((error) => console.error('Failed to save theme', error));
  };

  const handleModeToggle = () => {
    const nextMode = user?.mode === 'light' ? 'dark' : 'light';
    toggleMode();
    updateMe({ mode: nextMode }).catch((error) => console.error('Failed to save mode', error));
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <Header
        user={user}
        view={view}
        onViewChange={setView}
        onModeToggle={handleModeToggle}
        onThemeSelect={handleThemeSelect}
        onLogout={logout}
      />

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {view === 'links' ? (
          <LinksView
            links={links}
            loadingLinks={loadingLinks}
            search={search}
            filter={filter}
            showLinkForm={showLinkForm}
            randomLoading={randomLoading}
            randomError={randomError}
            page={page}
            pagination={pagination}
            onSearchChange={setSearch}
            onFilterChange={setFilter}
            onToggleForm={() => setShowLinkForm((open) => !open)}
            onCreated={handleCreated}
            onArchiveToggle={handleToggleArchive}
            onDelete={handleDelete}
            onRandom={handleRandom}
            onLoadMore={() => setPage((p) => p + 1)}
          />
        ) : (
          <SettingsView />
        )}
      </main>
    </div>
  );
}
