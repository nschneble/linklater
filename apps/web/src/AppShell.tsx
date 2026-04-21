import {
  archiveLink,
  deleteLink,
  getLinks,
  getRandomLink,
  unarchiveLink,
  updateMe,
  type Link,
  type PaginatedLinks,
} from './lib/api';

import { useAuth } from './auth/AuthContext';
import { useEffect, useState } from 'react';
import { useTheme, type BaseTheme } from './theme/ThemeContext';
import { useMetadataPolling } from './lib/useMetadataPolling';

import Header from './components/Header';
import LinksView from './components/LinksView';
import SettingsView from './components/SettingsView';

type AppView = 'links' | 'settings';
type LinksFilter = 'active' | 'archived';

export default function AppShell() {
  const { logout, user } = useAuth();
  const { setBaseTheme, toggleMode } = useTheme();

  const [filter, setFilter] = useState<LinksFilter>('active');
  const [links, setLinks] = useState<Link[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<Pick<
    PaginatedLinks,
    'total' | 'limit'
  > | null>(null);
  const [pendingMetaLinkId, setPendingMetaLinkId] = useState<string | null>(
    null,
  );
  const [randomError, setRandomError] = useState<string | null>(null);
  const [randomLoading, setRandomLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [view, setView] = useState<AppView>('links');

  useMetadataPolling(pendingMetaLinkId, (updatedLink) => {
    setLinks((previous) =>
      previous.map((link) => (link.id === updatedLink.id ? updatedLink : link)),
    );
    setPendingMetaLinkId(null);
  });

  // resets to page 1 when the search or filter changes
  useEffect(() => {
    setPage(1);
  }, [search, filter]);

  // loads links when the search, filter, or page changes
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
    // only prepends when viewing active links
    if (filter === 'archived') {
      setShowLinkForm(false);
      return;
    }
    setLinks((previous) => [link, ...previous]);
    setShowLinkForm(false);
    setPendingMetaLinkId(link.id);
  };

  const handleToggleArchive = async (link: Link) => {
    try {
      const updated = link.archivedAt
        ? await unarchiveLink(link.id)
        : await archiveLink(link.id);

      setLinks((previous) => {
        if (filter === 'active' && updated.archivedAt) {
          return previous.filter((link) => link.id !== link.id);
        }
        if (filter === 'archived' && !updated.archivedAt) {
          return previous.filter((link) => link.id !== link.id);
        }
        return previous.map((link) => (link.id === link.id ? updated : link));
      });
    } catch (error: unknown) {
      console.error('Failed to toggle archive state', error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteLink(id);
      setLinks((previous) => previous.filter((link) => link.id !== id));
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
        setRandomError('No links available');
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
            onLoadMore={() => setPage((page) => page + 1)}
            onRandom={handleRandom}
            onSearchChange={setSearch}
            onToggleForm={() => setShowLinkForm((open) => !open)}
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
