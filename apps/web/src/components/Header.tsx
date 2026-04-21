import { gravatarUrl } from '../lib/gravatar';
import { useEffect, useRef, useState } from 'react';
import { useTheme, THEMES, type BaseTheme } from '../theme/ThemeContext';
import type { User } from '../auth/AuthContext';

type AppView = 'links' | 'settings';

interface HeaderProps {
  user: User;
  view: AppView;
  onLogout: () => void;
  onModeToggle: () => void;
  onThemeSelect: (theme: BaseTheme) => void;
  onViewChange: (view: AppView) => void;
}

export default function Header({
  user,
  view,
  onLogout,
  onModeToggle,
  onThemeSelect,
  onViewChange,
}: HeaderProps) {
  const avatarUrl = gravatarUrl(user.email, 64);
  const { baseTheme, mode } = useTheme();

  const [previewTheme, setPreviewTheme] = useState<string | null>(null);
  const [showThemeSubmenu, setShowThemeSubmenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [themeSubmenuOnLeft, setThemeSubmenuOnLeft] = useState(false);

  const avatarRef = useRef<HTMLButtonElement | null>(null);
  const hideSubmenuTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const themeRowRef = useRef<HTMLDivElement | null>(null);

  // resets submenu when main menu closes
  useEffect(() => {
    if (!showUserMenu) setShowThemeSubmenu(false);
  }, [showUserMenu]);

  // closes main menu on outside clicks
  useEffect(() => {
    if (!showUserMenu) return;

    function handleOutsideClicks(event: MouseEvent) {
      const target = event.target as Node;
      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        avatarRef.current &&
        !avatarRef.current.contains(target)
      ) {
        setShowUserMenu(false);
      }
    }

    document.addEventListener('mousedown', handleOutsideClicks);
    return () => document.removeEventListener('mousedown', handleOutsideClicks);
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
      // submenu is w-56 (e.g. 224px) + an 8px safety margin
      setThemeSubmenuOnLeft(rect.right + 224 + 8 > window.innerWidth);
    }
    setShowThemeSubmenu(true);
  };

  const handleThemeSelect = (theme: BaseTheme) => {
    onThemeSelect(theme);
    setShowUserMenu(false);
  };

  return (
    <header className="bg-[var(--bg-elevated)] border-b border-[var(--border)]">
      <div className="flex items-center justify-between max-w-5xl mx-auto px-4 py-3">
        <div className="flex items-center gap-2">
          <img
            className="w-8 h-8 rounded-xl"
            src="/linklater.svg"
            alt="Richard Linklater"
          />
          <div>
            <div className="text-[var(--text)] text-sm font-semibold">
              Linklater
            </div>
            <div className="text-[var(--text-muted)] text-xs">
              Save links now, read them later.
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <button
              className="flex items-center gap-2 px-2 py-1.5 bg-[var(--bg-elevated)] hover:bg-[var(--bg-surface)] border border-[var(--border)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded-full transition cursor-pointer"
              ref={avatarRef}
              type="button"
              onClick={() => setShowUserMenu((open) => !open)}
              aria-expanded={showUserMenu}
              aria-haspopup="true"
              aria-label="User menu"
            >
              <img
                src={avatarUrl}
                alt={user.email}
                className="w-7 h-7 rounded-full"
              />
              <i className="fa-solid fa-chevron-down text-[var(--text-muted)] text-[0.6rem]" />
            </button>

            {showUserMenu && (
              <div
                ref={menuRef}
                className="absolute right-0 w-60 mt-2 py-2 bg-[var(--bg-elevated)] border border-[var(--border)] text-xs shadow-black/40 shadow-lg rounded-xl animate-fade-in-up z-50"
              >
                <div className="mb-2 px-3 pb-2 border-b border-[var(--border)]">
                  <p className="text-[var(--text-subtle)] text-[0.65rem] uppercase tracking-tight font-semibold">
                    Logged in as
                  </p>
                  <p className="mt-1 text-[var(--text)] text-xs font-medium truncate">
                    {user.email}
                  </p>
                </div>

                <button
                  className="flex items-center gap-2 w-full px-3 py-2 hover:bg-[var(--bg-surface)] text-[var(--text)] text-left cursor-pointer"
                  type="button"
                  onClick={() => {
                    onViewChange('links');
                    setShowUserMenu(false);
                  }}
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
                  className="flex items-center gap-2 w-full px-3 py-2 hover:bg-[var(--bg-surface)] text-[var(--text)] text-left cursor-pointer"
                  type="button"
                  onClick={() => {
                    onViewChange('settings');
                    setShowUserMenu(false);
                  }}
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

                <button
                  className="flex items-center gap-2 w-full px-3 py-2 hover:bg-[var(--bg-surface)] text-[var(--text)] text-left cursor-pointer"
                  type="button"
                  onClick={onModeToggle}
                >
                  <i
                    className={`fa-solid text-[var(--text-muted)] text-[0.75rem] ${
                      mode === 'light' ? 'fa-moon' : 'fa-sun'
                    }`}
                  />
                  <span>
                    Switch to {mode === 'light' ? 'dark' : 'light'} mode
                  </span>
                </button>

                <div
                  ref={themeRowRef}
                  className="relative"
                  onMouseEnter={handleThemeRowEnter}
                  onMouseLeave={() => scheduleHide(baseTheme)}
                >
                  <div
                    className={`flex items-center gap-2 w-full px-3 py-2 text-[var(--text)] cursor-default ${
                      showThemeSubmenu
                        ? 'bg-[var(--bg-surface)]'
                        : 'hover:bg-[var(--bg-surface)]'
                    }`}
                  >
                    <i className="fa-solid fa-palette text-[var(--text-muted)] text-[0.75rem]" />
                    <div className="flex-1">
                      <div>Theme</div>
                      <div className="mt-0.5 text-[var(--text-muted)]">
                        {previewTheme && previewTheme !== baseTheme
                          ? `Previewing ${THEMES.find((theme) => theme.id === previewTheme)?.label}`
                          : THEMES.find((theme) => theme.id === baseTheme)
                              ?.label}
                      </div>
                    </div>
                    <i className="fa-solid fa-chevron-right text-[var(--text-subtle)] text-[0.6rem]" />
                  </div>

                  <div
                    className={`absolute top-0 w-56 py-2 bg-[var(--bg-elevated)] border border-[var(--border)] shadow-black/40 shadow-lg rounded-xl z-50
                      transition-[opacity,transform] duration-150 ease-out
                      ${showThemeSubmenu ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'}
                      ${themeSubmenuOnLeft ? 'right-[calc(100%-1px)] origin-right' : 'left-[calc(100%-1px)] origin-left'}`}
                    onMouseEnter={cancelHide}
                    onMouseLeave={() => scheduleHide(baseTheme)}
                  >
                    {THEMES.map((theme) => (
                      <button
                        className="flex items-center gap-2 w-full px-3 py-2 hover:bg-[var(--bg-surface)] text-[var(--text)] text-left cursor-pointer"
                        key={theme.id}
                        type="button"
                        onClick={() => handleThemeSelect(theme.id)}
                        onMouseEnter={() => {
                          setPreviewTheme(theme.id);

                          const root = document.documentElement;
                          root.style.setProperty(
                            '--theme-transition-duration',
                            '1s',
                          );
                          root.style.setProperty(
                            '--theme-transition-easing',
                            'ease-in',
                          );
                          root.dataset.theme = theme.id;
                        }}
                      >
                        <span
                          className="shrink-0 inline-block w-3 h-3 rounded-full"
                          style={{ backgroundColor: theme.accent }}
                        />
                        <span className="flex-1">{theme.label}</span>
                        {baseTheme === theme.id && (
                          <i className="fa-solid fa-check text-[var(--accent)] text-[0.6rem]" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  className="flex items-center gap-2 w-full mt-1 px-3 py-2 hover:bg-[var(--bg-surface)] border-t border-[var(--border)] text-[var(--text)] text-left cursor-pointer"
                  type="button"
                  onClick={() => {
                    setShowUserMenu(false);
                    onLogout();
                  }}
                >
                  <i className="fa-solid fa-right-from-bracket text-[var(--text-muted)] text-[0.75rem]" />
                  <span>Log out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
