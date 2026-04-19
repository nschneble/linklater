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
} from './lib/api';
import { gravatarUrl } from './lib/gravatar';
import LinkForm from './components/LinkForm';
import LinkCard from './components/LinkCard';
import SettingsView from './components/SettingsView';

type AppView = 'links' | 'settings';
type LinksFilter = 'active' | 'archived';

export default function AppShell() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();

  const [view, setView] = useState<AppView>('links');
  const [links, setLinks] = useState<Link[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<LinksFilter>('active');
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showThemeSubmenu, setShowThemeSubmenu] = useState(false);
  const [themeSubmenuOnLeft, setThemeSubmenuOnLeft] = useState(false);
  const [previewTheme, setPreviewTheme] = useState<string | null>(null);
  const themeRowRef = useRef<HTMLDivElement | null>(null);
  const hideSubmenuTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [randomLoading, setRandomLoading] = useState(false);
  const [randomError, setRandomError] = useState<string | null>(null);

  const avatarUrl = user ? gravatarUrl(user.email, 64) : '';
  const avatarRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // load links when search/filter changes
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoadingLinks(true);
      try {
        const data = await getLinks({
          search: search || undefined,
          archived: filter === 'archived' ? true : false,
        });
        if (!cancelled) setLinks(data);
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
  }, [search, filter]);

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

  const scheduleHide = (currentTheme: string) => {
    cancelHide();
    setShowThemeSubmenu(false);
    setPreviewTheme(null);
    const root = document.documentElement;
    root.style.setProperty('--theme-transition-duration', '250ms');
    root.style.setProperty('--theme-transition-easing', 'ease-out');
    root.dataset.theme = currentTheme;
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

  const handleSelectTheme = (id: typeof theme) => {
    setTheme(id);
    setShowUserMenu(false);
    updateMe({ theme: id }).catch((err) =>
      console.error('Failed to save theme', err),
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
                  onClick={() => setShowUserMenu((open) => !open)}
                  className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-1.5 hover:bg-[var(--bg-surface)] transition cursor-pointer"
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
                    className="absolute right-0 mt-2 w-60 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] shadow-lg shadow-black/40 py-2 text-xs"
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

                    {/* Theme row — hover opens flyout submenu */}
                    <div
                      ref={themeRowRef}
                      className="relative"
                      onMouseEnter={handleThemeRowEnter}
                      onMouseLeave={() => scheduleHide(theme)}
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
                            {previewTheme && previewTheme !== theme
                              ? `Previewing ${THEMES.find((t) => t.id === previewTheme)?.label}`
                              : THEMES.find((t) => t.id === theme)?.label}
                          </div>
                        </div>
                        <i className="fa-solid fa-chevron-right text-[0.6rem] text-[var(--text-subtle)]" />
                      </div>

                      <div
                        onMouseEnter={cancelHide}
                        onMouseLeave={() => scheduleHide(theme)}
                        className={`absolute top-0 w-56 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] shadow-lg shadow-black/40 py-2
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
                            {theme === t.id && (
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
              <div className="inline-flex rounded-full bg-[var(--bg-surface)] border border-[var(--border)] p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setFilter('active')}
                  className={`px-3 py-1.5 rounded-full transition ${
                    filter === 'active'
                      ? 'bg-[var(--text)] text-[var(--bg)] font-semibold'
                      : 'text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] cursor-pointer'
                  }`}
                >
                  Your links
                </button>
                <button
                  type="button"
                  onClick={() => setFilter('archived')}
                  className={`px-3 py-1.5 rounded-full transition ${
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
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search your links…"
                className="w-full sm:max-w-sm rounded-lg border border-[var(--border)] px-3 py-2 text-sm bg-[var(--bg-input)] text-[var(--text)] placeholder:text-[var(--text-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/70"
              />
              <button
                type="button"
                onClick={() => setShowLinkForm((open) => !open)}
                className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[var(--accent)] text-[var(--accent-fg)] font-semibold text-xs px-4 py-2 shadow-md hover:bg-[var(--accent-hover)] transition cursor-pointer"
              >
                <i className="fa-solid fa-plus text-[0.7rem]" />
                {showLinkForm ? 'Hide form' : 'Add link'}
              </button>
            </div>

            {randomError && (
              <p className="mt-2 text-xs text-rose-300">{randomError}</p>
            )}

            {showLinkForm && (
              <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
                <LinkForm onCreated={handleCreated} />
              </div>
            )}

            <div className="mt-6 space-y-3">
              {loadingLinks ? (
                <p className="text-sm text-[var(--text-muted)]">Loading links…</p>
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
            </div>
          </>
        ) : (
          <SettingsView />
        )}
      </main>
    </div>
  );
}
