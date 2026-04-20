import { useEffect, useRef, useState } from 'react';
import { useAuth } from './auth/AuthContext';
import { useTheme, THEMES } from './theme/ThemeContext';
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
import { gravatarUrl } from './lib/gravatar';
import { useMetadataPolling } from './lib/useMetadataPolling';
import LinkForm from './components/LinkForm';
import LinkCard, { LinkCardSkeleton } from './components/LinkCard';
import SettingsView from './components/SettingsView';

type AppView = 'links' | 'settings';
type LinksFilter = 'active' | 'archived';

export default function AppShell() {
  const { user, logout } = useAuth();
  const { baseTheme, mode, setBaseTheme, toggleMode } = useTheme();

  const [view, setView] = useState<AppView>('links');
  const [links, setLinks] = useState<Link[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<LinksFilter>('active');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<Pick<PaginatedLinks, 'total' | 'limit'> | null>(null);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showThemeSubmenu, setShowThemeSubmenu] = useState(false);
  const [themeSubmenuOnLeft, setThemeSubmenuOnLeft] = useState(false);
  const [previewTheme, setPreviewTheme] = useState<string | null>(null);
  const themeRowRef = useRef<HTMLDivElement | null>(null);
  const hideSubmenuTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [randomLoading, setRandomLoading] = useState(false);
  const [randomError, setRandomError] = useState<string | null>(null);
  const [pendingMetaLinkId, setPendingMetaLinkId] = useState<string | null>(null);

  useMetadataPolling(pendingMetaLinkId, (updatedLink) => {
    setLinks((prev) => prev.map((l) => (l.id === updatedLink.id ? updatedLink : l)));
    setPendingMetaLinkId(null);
  });

  const avatarUrl = user ? gravatarUrl(user.email, 64) : '';
  const avatarRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // reset to page 1 when search or filter changes
  useEffect(() => {
    setPage(1);
  }, [search, filter]);

  // load links when search/filter/page changes
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
      } catch (err) {
        console.error('Failed to load links', err);
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

  // reset submenu when the menu closes
  useEffect(() => {
    if (!showUserMenu) setShowThemeSubmenu(false);
  }, [showUserMenu]);

  const cancelHide = () => {
    if (hideSubmenuTimeout.current) {
      clearTimeout(hideSubmenuTimeout.current);
      hideSubmenuTimeout.current = null;
    }
  };

  const scheduleHide = (currentBaseTheme: string) => {
    cancelHide();
    setShowThemeSubmenu(false);
    setPreviewTheme(null);
    const root = document.documentElement;
    root.style.setProperty('--theme-transition-duration', '250ms');
    root.style.setProperty('--theme-transition-easing', 'ease-out');
    root.dataset.theme = currentBaseTheme;
  };

  const handleThemeRowEnter = () => {
    cancelHide();
    if (themeRowRef.current) {
      const rect = themeRowRef.current.getBoundingClientRect();
      // submenu is w-56 = 224px; 8px safety margin
      setThemeSubmenuOnLeft(rect.right + 224 + 8 > window.innerWidth);
    }
    setShowThemeSubmenu(true);
  };

  // close user menu on outside click
  useEffect(() => {
    if (!showUserMenu) return;

    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        avatarRef.current &&
        !avatarRef.current.contains(target)
      ) {
        setShowUserMenu(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showUserMenu]);

  const handleCreated = (link: Link) => {
    // new links are always active; only prepend when viewing active links
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
        // if we're viewing active links and this just became archived, remove it
        if (filter === 'active' && updated.archivedAt) {
          return prev.filter((l) => l.id !== link.id);
        }

        // if we're viewing archived links and this just became active, remove it
        if (filter === 'archived' && !updated.archivedAt) {
          return prev.filter((l) => l.id !== link.id);
        }

        // otherwise, just update the item in place
        return prev.map((l) => (l.id === link.id ? updated : l));
      });
    } catch (err: unknown) {
      console.error('Failed to toggle archive state', err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteLink(id);
      setLinks((prev) => prev.filter((l) => l.id !== id));
    } catch (err: unknown) {
      console.error('Failed to delete link', err);
    }
  };

  const handleRandom = async () => {
    setRandomError(null);
    setRandomLoading(true);
    try {
      const { link } = await getRandomLink({
        archived: filter === 'archived',
      });
      if (!link) {
        setRandomError('No links available to randomize');
      } else {
        window.open(link.url, '_blank', 'noopener,noreferrer');
      }
    } catch (err: unknown) {
      setRandomError('Failed to get a random link');
      console.error('Failed to get a random link', err);
    } finally {
      setRandomLoading(false);
    }
  };

  const handleSelectTheme = (id: typeof baseTheme) => {
    setBaseTheme(id);
    setShowUserMenu(false);
    updateMe({ theme: id }).catch((err) =>
      console.error('Failed to save theme', err),
    );
  };

  const handleToggleMode = () => {
    const nextMode = mode === 'light' ? 'dark' : 'light';
    toggleMode();
    updateMe({ mode: nextMode }).catch((err) =>
      console.error('Failed to save mode', err),
    );
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <header className="border-b border-[var(--border)] bg-[var(--bg-elevated)]">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <img
              className="h-8 w-8 rounded-xl"
              src="/linklater.svg"
              alt="Richard Linklater"
            />
            <div>
              <div className="font-semibold text-sm text-[var(--text)]">
                Linklater
              </div>
              <div className="text-xs text-[var(--text-muted)]">
                Save links now, read them later.
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {avatarUrl && (
              <div className="relative">
                <button
                  ref={avatarRef}
                  type="button"
                  aria-label="User menu"
                  aria-haspopup="true"
                  aria-expanded={showUserMenu}
                  onClick={() => setShowUserMenu((open) => !open)}
                  className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-1.5 hover:bg-[var(--bg-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] transition cursor-pointer"
                >
                  <img
                    src={avatarUrl}
                    alt={user?.email ?? 'User avatar'}
                    className="h-7 w-7 rounded-full"
                  />
                  <i className="fa-solid fa-chevron-down text-[0.6rem] text-[var(--text-muted)]" />
                </button>

                {showUserMenu && (
                  <div
                    ref={menuRef}
                    className="animate-fade-in-up absolute right-0 mt-2 w-60 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] shadow-lg shadow-black/40 py-2 text-xs z-50"
                  >
                    <div className="px-3 pb-2 border-b border-[var(--border)] mb-2">
                      <p className="text-[0.65rem] uppercase tracking-tight font-semibold text-[var(--text-subtle)]">
                        Signed in as
                      </p>
                      <p className="mt-1 truncate text-[var(--text)] font-medium text-xs">
                        {user?.email}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setView('links');
                        setShowUserMenu(false);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 hover:bg-[var(--bg-surface)] text-left cursor-pointer text-[var(--text)]"
                    >
                      <i
                        className={`fa-solid fa-bookmark text-[0.75rem] ${
                          view === 'links'
                            ? 'text-[var(--accent)]'
                            : 'text-[var(--text-muted)]'
                        }`}
                      />
                      <span>Your links</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setView('settings');
                        setShowUserMenu(false);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 hover:bg-[var(--bg-surface)] text-left cursor-pointer text-[var(--text)]"
                    >
                      <i
                        className={`fa-solid fa-gear text-[0.75rem] ${
                          view === 'settings'
                            ? 'text-[var(--accent)]'
                            : 'text-[var(--text-muted)]'
                        }`}
                      />
                      <span>Settings</span>
                    </button>

                    {/* Light/dark mode toggle */}
                    <button
                      type="button"
                      onClick={handleToggleMode}
                      className="flex w-full items-center gap-2 px-3 py-2 hover:bg-[var(--bg-surface)] text-[var(--text)] text-left cursor-pointer"
                    >
                      <i
                        className={`fa-solid ${mode === 'light' ? 'fa-moon' : 'fa-sun'} text-[0.75rem] text-[var(--text-muted)]`}
                      />
                      <span>Switch to {mode === 'light' ? 'dark' : 'light'} mode</span>
                    </button>

                    {/* Theme row — hover opens flyout submenu */}
                    <div
                      ref={themeRowRef}
                      className="relative"
                      onMouseEnter={handleThemeRowEnter}
                      onMouseLeave={() => scheduleHide(baseTheme)}
                    >
                      <div
                        className={`flex w-full items-center gap-2 px-3 py-2 cursor-default text-[var(--text)] ${
                          showThemeSubmenu ? 'bg-[var(--bg-surface)]' : 'hover:bg-[var(--bg-surface)]'
                        }`}
                      >
                        <i className="fa-solid fa-palette text-[0.75rem] text-[var(--text-muted)]" />
                        <div className="flex-1">
                          <div>Theme</div>
                          <div className="text-[var(--text-muted)] mt-0.5">
                            {previewTheme && previewTheme !== baseTheme
                              ? `Previewing ${THEMES.find((t) => t.id === previewTheme)?.label}`
                              : THEMES.find((t) => t.id === baseTheme)?.label}
                          </div>
                        </div>
                        <i className="fa-solid fa-chevron-right text-[0.6rem] text-[var(--text-subtle)]" />
                      </div>

                      <div
                        onMouseEnter={cancelHide}
                        onMouseLeave={() => scheduleHide(baseTheme)}
                        className={`absolute top-0 w-56 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] shadow-lg shadow-black/40 py-2 z-50
                          transition-[opacity,transform] duration-150 ease-out
                          ${showThemeSubmenu ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'}
                          ${themeSubmenuOnLeft ? 'right-[calc(100%-1px)] origin-right' : 'left-[calc(100%-1px)] origin-left'}`}
                      >
                        {THEMES.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onMouseEnter={() => {
                              setPreviewTheme(t.id);
                              const root = document.documentElement;
                              root.style.setProperty('--theme-transition-duration', '1s');
                              root.style.setProperty('--theme-transition-easing', 'ease-in');
                              root.dataset.theme = t.id;
                            }}
                            onClick={() => handleSelectTheme(t.id)}
                            className="flex w-full items-center gap-2 px-3 py-2 hover:bg-[var(--bg-surface)] text-left cursor-pointer text-[var(--text)]"
                          >
                            <span
                              className="inline-block h-3 w-3 rounded-full shrink-0"
                              style={{ backgroundColor: t.accent }}
                            />
                            <span className="flex-1">{t.label}</span>
                            {baseTheme === t.id && (
                              <i className="fa-solid fa-check text-[0.6rem] text-[var(--accent)]" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setShowUserMenu(false);
                        logout();
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 mt-1 border-t border-[var(--border)] hover:bg-[var(--bg-surface)] text-[var(--text)] text-left cursor-pointer"
                    >
                      <i className="fa-solid fa-right-from-bracket text-[0.75rem] text-[var(--text-muted)]" />
                      <span>Log out</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {view === 'links' ? (
          <>
            <h2 className="text-lg font-semibold">
              {filter === 'archived' ? 'Archived links' : 'Your links'}
            </h2>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              {filter === 'archived'
                ? "Review things you've already read or decided to move aside."
                : "Add links, search, archive, and let Linklater pick something at random when you're indecisive."}
            </p>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div role="tablist" aria-label="Links filter" className="inline-flex rounded-full bg-[var(--bg-surface)] border border-[var(--border)] p-1 text-xs">
                <button
                  type="button"
                  role="tab"
                  aria-selected={filter === 'active'}
                  onClick={() => setFilter('active')}
                  className={`px-3 py-1.5 rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                    filter === 'active'
                      ? 'bg-[var(--text)] text-[var(--bg)] font-semibold'
                      : 'text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] cursor-pointer'
                  }`}
                >
                  Your links
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={filter === 'archived'}
                  onClick={() => setFilter('archived')}
                  className={`px-3 py-1.5 rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                    filter === 'archived'
                      ? 'bg-[var(--text)] text-[var(--bg)] font-semibold'
                      : 'text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] cursor-pointer'
                  }`}
                >
                  Archived
                </button>
              </div>

              <button
                type="button"
                onClick={handleRandom}
                disabled={randomLoading}
                className="px-4 py-2 inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text)] font-semibold shadow-md text-xs disabled:opacity-60 disabled:cursor-wait cursor-pointer hover:bg-[var(--bg-surface)]"
              >
                <i className="fa-solid fa-shuffle text-[0.7rem]" />
                {randomLoading ? 'Rolling…' : 'Random link'}
              </button>
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <input
                type="search"
                aria-label="Search your links"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search your links…"
                className="w-full sm:max-w-sm rounded-lg border border-[var(--border)] px-3 py-2 text-sm bg-[var(--bg-input)] text-[var(--text)] placeholder:text-[var(--text-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/70"
              />
              <button
                type="button"
                aria-expanded={showLinkForm}
                onClick={() => setShowLinkForm((open) => !open)}
                className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[var(--accent)] text-[var(--accent-fg)] font-semibold text-xs px-4 py-2 shadow-md hover:bg-[var(--accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] transition cursor-pointer"
              >
                <i className="fa-solid fa-plus text-[0.7rem]" />
                {showLinkForm ? 'Hide form' : 'Add link'}
              </button>
            </div>

            {randomError && (
              <p role="alert" className="animate-fade-in-up mt-2 text-xs text-rose-300">{randomError}</p>
            )}

            {showLinkForm && (
              <div className="animate-fade-in-up mt-4 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
                <LinkForm onCreated={handleCreated} />
              </div>
            )}

            <div className="mt-6 space-y-3">
              {loadingLinks && page === 1 ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <LinkCardSkeleton key={index} />
                ))
              ) : links.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">
                  No links yet. Click{' '}
                  <span className="font-semibold">Add link</span> to save
                  something for later.
                </p>
              ) : (
                links.map((link) => (
                  <LinkCard
                    key={link.id}
                    link={link}
                    onArchiveToggle={() => handleToggleArchive(link)}
                    onDelete={() => handleDelete(link.id)}
                  />
                ))
              )}

              {pagination && links.length < pagination.total && (
                <div className="flex justify-center pt-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={loadingLinks}
                    className="px-4 py-2 text-xs rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text)] hover:bg-[var(--bg-surface)] disabled:opacity-60 disabled:cursor-wait cursor-pointer"
                  >
                    {loadingLinks ? 'Loading…' : `Load more (${pagination.total - links.length} remaining)`}
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <SettingsView />
        )}
      </main>
    </div>
  );
}
