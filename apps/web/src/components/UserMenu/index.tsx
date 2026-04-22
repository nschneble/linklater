import { gravatarUrl } from '../../lib/gravatar';
import { useEffect, useRef, useState } from 'react';
import { useTheme, type BaseTheme } from '../../theme/ThemeContext';
import MenuItem from './MenuItem';
import ThemeSubmenu from './ThemeSubmenu';
import type { User } from '../../auth/AuthContext';

type AppView = 'links' | 'settings';

interface UserMenuProps {
  user: User;
  view: AppView;
  onLogout: () => void;
  onModeToggle: () => void;
  onThemeSelect: (theme: BaseTheme) => void;
  onViewChange: (view: AppView) => void;
}

export default function UserMenu({
  user,
  view,
  onLogout,
  onModeToggle,
  onThemeSelect,
  onViewChange,
}: UserMenuProps) {
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
      // submenu is w-56 (224px) + an 8px safety margin
      setThemeSubmenuOnLeft(rect.right + 224 + 8 > window.innerWidth);
    }
    setShowThemeSubmenu(true);
  };

  const handleThemeSelect = (theme: BaseTheme) => {
    onThemeSelect(theme);
    setShowUserMenu(false);
  };

  return (
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

          <MenuItem
            icon="fa-bookmark"
            label="Your links"
            onClick={() => {
              onViewChange('links');
              setShowUserMenu(false);
            }}
            active={view === 'links'}
          />

          <MenuItem
            icon="fa-gear"
            label="Settings"
            onClick={() => {
              onViewChange('settings');
              setShowUserMenu(false);
            }}
            active={view === 'settings'}
          />

          <MenuItem
            icon={mode === 'light' ? 'fa-moon' : 'fa-sun'}
            label={`Switch to ${mode === 'light' ? 'dark' : 'light'} mode`}
            onClick={onModeToggle}
          />

          <div
            ref={themeRowRef}
            className="relative"
            onMouseEnter={handleThemeRowEnter}
            onMouseLeave={() => scheduleHide(baseTheme)}
          >
            <ThemeSubmenu
              baseTheme={baseTheme}
              previewTheme={previewTheme}
              showSubmenu={showThemeSubmenu}
              submenuOnLeft={themeSubmenuOnLeft}
              onFlyoutMouseEnter={cancelHide}
              onFlyoutMouseLeave={() => scheduleHide(baseTheme)}
              onPreviewChange={setPreviewTheme}
              onSelect={handleThemeSelect}
            />
          </div>

          <MenuItem
            icon="fa-right-from-bracket"
            label="Log out"
            onClick={() => {
              setShowUserMenu(false);
              onLogout();
            }}
            className="mt-1 border-t border-[var(--border)]"
          />
        </div>
      )}
    </div>
  );
}
