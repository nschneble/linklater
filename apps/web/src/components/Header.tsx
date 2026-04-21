import { useEffect, useRef, useState } from 'react';
import { useTheme, THEMES, type BaseTheme } from '../theme/ThemeContext';
import { gravatarUrl } from '../lib/gravatar';
import type { User } from '../auth/AuthContext';

type AppView = 'links' | 'settings';

interface HeaderProps {
  user: User;
  view: AppView;
  onViewChange: (view: AppView) => void;
  onModeToggle: () => void;
  onThemeSelect: (theme: BaseTheme) => void;
  onLogout: () => void;
}

export default function Header({
  user,
  view,
  onViewChange,
  onModeToggle,
  onThemeSelect,
  onLogout,
}: HeaderProps) {
  const { baseTheme, mode } = useTheme();
  const avatarUrl = gravatarUrl(user.email, 64);

  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showThemeSubmenu, setShowThemeSubmenu] = useState(false);
  const [themeSubmenuOnLeft, setThemeSubmenuOnLeft] = useState(false);
  const [previewTheme, setPreviewTheme] = useState<string | null>(null);

  const avatarRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const themeRowRef = useRef<HTMLDivElement | null>(null);
  const hideSubmenuTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset submenu when user menu closes
  useEffect(() => {
    if (!showUserMenu) setShowThemeSubmenu(false);
  }, [showUserMenu]);

  // Close user menu on outside click
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

  const handleThemeSelect = (theme: BaseTheme) => {
    onThemeSelect(theme);
    setShowUserMenu(false);
  };

  return (
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
                alt={user.email}
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
                    {user.email}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onViewChange('links');
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
                    onViewChange('settings');
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

                <button
                  type="button"
                  onClick={onModeToggle}
                  className="flex w-full items-center gap-2 px-3 py-2 hover:bg-[var(--bg-surface)] text-[var(--text)] text-left cursor-pointer"
                >
                  <i
                    className={`fa-solid ${mode === 'light' ? 'fa-moon' : 'fa-sun'} text-[0.75rem] text-[var(--text-muted)]`}
                  />
                  <span>
                    Switch to {mode === 'light' ? 'dark' : 'light'} mode
                  </span>
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
                      showThemeSubmenu
                        ? 'bg-[var(--bg-surface)]'
                        : 'hover:bg-[var(--bg-surface)]'
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
                          root.style.setProperty(
                            '--theme-transition-duration',
                            '1s',
                          );
                          root.style.setProperty(
                            '--theme-transition-easing',
                            'ease-in',
                          );
                          root.dataset.theme = t.id;
                        }}
                        onClick={() => handleThemeSelect(t.id)}
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
                    onLogout();
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 mt-1 border-t border-[var(--border)] hover:bg-[var(--bg-surface)] text-[var(--text)] text-left cursor-pointer"
                >
                  <i className="fa-solid fa-right-from-bracket text-[0.75rem] text-[var(--text-muted)]" />
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
