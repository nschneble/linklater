import MobileBottomSheet from './UserMenu/MobileBottomSheet';
import UserMenu from './UserMenu';
import { useEffect, useRef } from 'react';
import { useTheme } from '../theme/ThemeContext';
import type { AppView } from '../lib/navigation';
import type { BaseTheme } from '../theme/ThemeContext';
import type { User } from '../auth/AuthContext';

interface HeaderProps {
  /** The authenticated user – displayed in the `UserMenu` avatar and email label. */
  user: User;
  /** The currently active view – passed to `UserMenu` to highlight the active item. */
  view: AppView;
  /** Whether the user menu dropdown is open. Owned by `AppShell`. */
  isUserMenuOpen: boolean;
  /**
   * When `true`, marks the whole header (and its `UserMenu` / mobile bottom
   * sheet descendants) inert. Set by `AppShell` while the links view's
   * `aria-modal` save-link dialog is open so the header chrome, which lives
   * outside that dialog's subtree, cannot be reached by click-through or
   * assistive-tech browse mode (WCAG 2.4.3 / 4.1.2).
   */
  inert?: boolean;
  /** Called when the avatar button is clicked to toggle the menu. */
  onUserMenuToggle: () => void;
  /** Called to imperatively close the menu. */
  onUserMenuClose: () => void;
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
  isUserMenuOpen,
  inert,
  onUserMenuToggle,
  onUserMenuClose,
  onLogout,
  onModeToggle,
  onThemeSelect,
  onViewChange,
}: HeaderProps) {
  const { baseTheme, mode } = useTheme();
  const avatarButtonReference = useRef<HTMLButtonElement | null>(null);
  const userMenuContainerReference = useRef<HTMLDivElement | null>(null);
  const bottomSheetReference = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isUserMenuOpen) return;

    function handleOutsideInteraction(event: MouseEvent | TouchEvent) {
      const target = event.target as Node;
      // without the sheet check, a sheet tap self-closes before its click
      if (
        userMenuContainerReference.current?.contains(target) ||
        bottomSheetReference.current?.contains(target)
      ) {
        return;
      }
      onUserMenuClose();
    }

    function handleEscapeKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onUserMenuClose();
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
  }, [isUserMenuOpen, onUserMenuClose]);

  return (
    <header
      inert={inert}
      className="bg-[var(--orbit-bg)] border-b border-[var(--orbit-border)]"
    >
      <div className="flex items-center justify-between max-w-4xl mx-auto px-4 py-3">
        <button
          type="button"
          aria-label="Go to your links"
          className="flex items-center gap-2 active:scale-[0.96] transition-transform duration-200 cursor-pointer"
          onClick={() => {
            onViewChange('links');
          }}
        >
          <img
            className="safe-themed-asset hidden sm:inline-flex w-8 h-8 outline outline-black/10 -outline-offset-1 rounded-4xl"
            src="/assets/img/linklater.jpg"
            alt=""
            aria-hidden="true"
          />
          <div className="text-left">
            <div className="text-[var(--orbit-text)] text-sm font-semibold">
              Linklater
            </div>
            <div className="text-[var(--orbit-alt-text)] text-xs">
              Save links now, read them later.
            </div>
          </div>
        </button>

        <div
          ref={userMenuContainerReference}
          className="flex items-center gap-3"
        >
          <UserMenu
            ref={avatarButtonReference}
            user={user}
            view={view}
            isOpen={isUserMenuOpen}
            onToggle={onUserMenuToggle}
            onClose={onUserMenuClose}
            onLogout={onLogout}
            onModeToggle={onModeToggle}
            onThemeSelect={onThemeSelect}
            onViewChange={onViewChange}
          />
        </div>
      </div>

      <MobileBottomSheet
        ref={bottomSheetReference}
        user={user}
        view={view}
        isOpen={isUserMenuOpen}
        baseTheme={baseTheme}
        mode={mode}
        onClose={onUserMenuClose}
        onLogout={onLogout}
        onModeToggle={onModeToggle}
        onThemeSelect={onThemeSelect}
        onViewChange={onViewChange}
      />
    </header>
  );
}
