import MobileBottomSheet from './UserMenu/MobileBottomSheet';
import UserMenu from './UserMenu';
import { useEffect, useRef, useState } from 'react';
import { useTheme } from '../theme/ThemeContext';
import type { AppView } from '../lib/navigation';
import type { BaseTheme } from '../theme/ThemeContext';
import type { User } from '../auth/AuthContext';

interface HeaderProps {
  /** The authenticated user — displayed in the `UserMenu` avatar and email label. */
  user: User;
  /** The currently active view — passed to `UserMenu` to highlight the active item. */
  view: AppView;
  /** Called when the user clicks "Log out" in the `UserMenu`. */
  onLogout: () => void;
  /** Called when the user toggles light/dark mode in the `UserMenu`. */
  onModeToggle: () => void;
  /** Called when the user selects a theme from the theme submenu. */
  onThemeSelect: (theme: BaseTheme) => void;
  /** Called when the user navigates to a different view from the `UserMenu`. */
  onViewChange: (view: AppView) => void;
}

/**
 * The top-of-page navigation bar, visible on all authenticated routes.
 *
 * Contains:
 * - A logo/title button that navigates to the links view.
 * - A `UserMenu` with avatar, navigation, theme, and mode controls.
 * - A `MobileMenuPanel` that renders below the header row on mobile viewports.
 *
 * Owns `showUserMenu` state and delegates it to both `UserMenu` (via `isOpen`
 * / `onToggle` / `onClose`) and `MobileMenuPanel` (via `isOpen`). Document-level
 * listeners for outside clicks and Escape live here so they cover both the
 * desktop dropdown and the mobile panel in a single place.
 */
export default function Header({
  user,
  view,
  onLogout,
  onModeToggle,
  onThemeSelect,
  onViewChange,
}: HeaderProps) {
  const { baseTheme, mode } = useTheme();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const avatarButtonReference = useRef<HTMLButtonElement | null>(null);
  const headerReference = useRef<HTMLElement | null>(null);

  function handleUserMenuToggle() {
    setShowUserMenu((open) => !open);
  }

  function handleUserMenuClose() {
    setShowUserMenu(false);
  }

  useEffect(() => {
    if (!showUserMenu) return;

    function handleOutsideInteraction(event: MouseEvent | TouchEvent) {
      const target = event.target as Node;
      if (
        headerReference.current &&
        !headerReference.current.contains(target)
      ) {
        setShowUserMenu(false);
      }
    }

    function handleEscapeKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setShowUserMenu(false);
        avatarButtonReference.current?.focus();
      }
    }

    document.addEventListener('mousedown', handleOutsideInteraction);
    document.addEventListener('touchstart', handleOutsideInteraction);
    document.addEventListener('keydown', handleEscapeKey);
    return () => {
      document.removeEventListener('mousedown', handleOutsideInteraction);
      document.removeEventListener('touchstart', handleOutsideInteraction);
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [showUserMenu]);

  return (
    <header
      ref={headerReference}
      className="bg-[var(--bg-elevated)] border-b border-[var(--border)]"
    >
      <div className="flex items-center justify-between max-w-4xl mx-auto px-4 py-3">
        <button
          type="button"
          aria-label="Go to your links"
          className="flex items-center gap-2 cursor-pointer active:scale-[0.96] transition-transform duration-200"
          onClick={() => {
            onViewChange('links');
          }}
        >
          <img
            className="hidden sm:inline-flex w-8 h-8 outline outline-black/10 -outline-offset-1 rounded-4xl"
            src="/assets/img/linklater.jpg"
            alt=""
            aria-hidden="true"
          />
          <div className="text-left">
            <div className="text-[var(--text)] text-sm font-semibold">
              Linklater
            </div>
            <div className="text-[var(--text-muted)] text-xs">
              Save links now, read them later.
            </div>
          </div>
        </button>

        <div className="flex items-center gap-3">
          <UserMenu
            ref={avatarButtonReference}
            user={user}
            view={view}
            isOpen={showUserMenu}
            onToggle={handleUserMenuToggle}
            onClose={handleUserMenuClose}
            onLogout={onLogout}
            onModeToggle={onModeToggle}
            onThemeSelect={onThemeSelect}
            onViewChange={onViewChange}
          />
        </div>
      </div>

      <MobileBottomSheet
        user={user}
        view={view}
        isOpen={showUserMenu}
        baseTheme={baseTheme}
        mode={mode}
        onClose={handleUserMenuClose}
        onLogout={onLogout}
        onModeToggle={onModeToggle}
        onThemeSelect={onThemeSelect}
        onViewChange={onViewChange}
      />
    </header>
  );
}
