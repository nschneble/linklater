import { gravatarUrl } from '../../lib/gravatar';
import { FOCUS_RING } from '../../lib/styles';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTheme, type BaseTheme } from '../../theme/ThemeContext';
import MenuSection from './MenuSection';
import MenuItem from './MenuItem';
import ThemeSubmenu from './ThemeSubmenu';
import { useMenuNavigation } from './useMenuNavigation';
import type { AppView } from '../../lib/navigation';
import type { User } from '../../auth/AuthContext';

interface UserMenuProps {
  /** The authenticated user. Email is used for the Gravatar avatar and the "Logged in as" label. */
  user: User;
  /** The currently active view — highlights the corresponding menu item. */
  view: AppView;
  onLogout: () => void;
  onModeToggle: () => void;
  onThemeSelect: (theme: BaseTheme) => void;
  onViewChange: (view: AppView) => void;
}

/**
 * Avatar button that opens a dropdown menu with navigation, theme/mode
 * controls, and logout.
 *
 * State:
 * - `showUserMenu` — whether the main dropdown is visible.
 * - `showThemeSubmenu` — whether the theme flyout is visible.
 * - `previewTheme` — the theme currently being previewed on hover.
 * - `themeSubmenuOnLeft` — whether the flyout opens left (when near the right edge).
 * - `isThemeAreaPointerOver` — whether the mouse is over the theme row + flyout area.
 *
 * The theme submenu stays open until the user mouses over another menu item or
 * closes the main menu. Hover tracking uses the `themeRowReference` wrapper div
 * (which contains both the trigger row and the flyout panel) so the submenu does
 * not close when moving between the two.
 *
 * Keyboard navigation within the dropdown is handled by `useMenuNavigation`.
 * Clicking outside the menu closes it via a `mousedown` listener on `document`.
 *
 * The Gravatar URL is memoized so it only recomputes when `user.email` changes.
 */
export default function UserMenu({
  user,
  view,
  onLogout,
  onModeToggle,
  onThemeSelect,
  onViewChange,
}: UserMenuProps) {
  const avatarUrl = useMemo(() => gravatarUrl(user.email, 64), [user.email]);
  const { baseTheme, mode } = useTheme();

  const [isThemeAreaPointerOver, setIsThemeAreaPointerOver] = useState(false);
  const [previewTheme, setPreviewTheme] = useState<string | null>(null);
  const [showThemeSubmenu, setShowThemeSubmenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [themeSubmenuOnLeft, setThemeSubmenuOnLeft] = useState(true);

  const avatarReference = useRef<HTMLButtonElement | null>(null);
  const flyoutReference = useRef<HTMLDivElement | null>(null);
  const menuReference = useRef<HTMLDivElement | null>(null);
  const openedByKeyboard = useRef(false);
  const resetTransitionTimeout = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const submenuOpenedByKeyboard = useRef(false);
  const themeRowReference = useRef<HTMLDivElement | null>(null);

  useMenuNavigation(menuReference, () => {
    setShowUserMenu(false);
    avatarReference.current?.focus();
  });

  const closeFlyout = () => {
    setShowThemeSubmenu(false);
    resetPreview(baseTheme);
    menuReference.current
      ?.querySelector<HTMLElement>('[aria-haspopup="menu"]')
      ?.focus();
  };

  useMenuNavigation(
    flyoutReference,
    closeFlyout,
    '[data-submenu-item]',
    closeFlyout,
  );

  // resets submenu when main menu closes; moves focus into menu on open
  useEffect(() => {
    if (!showUserMenu) {
      setShowThemeSubmenu(false);
      setIsThemeAreaPointerOver(false);
      return;
    }
    if (openedByKeyboard.current) {
      // Keyboard open: focus first item so arrow-key navigation starts
      // immediately
      const firstItem =
        menuReference.current?.querySelector<HTMLElement>('[role="menuitem"]');
      firstItem?.focus();
    } else {
      // Mouse open: focus the container so keydown events reach
      // useMenuNavigation without visually pre-selecting any item
      menuReference.current?.focus();
    }
  }, [showUserMenu]);

  // auto-focuses first flyout item when submenu opens via keyboard
  useEffect(() => {
    if (!showThemeSubmenu || !submenuOpenedByKeyboard.current) return;
    submenuOpenedByKeyboard.current = false;
    const firstItem = flyoutReference.current?.querySelector<HTMLElement>(
      '[data-submenu-item]',
    );
    firstItem?.focus();
  }, [showThemeSubmenu]);

  // closes main menu on outside clicks
  useEffect(() => {
    if (!showUserMenu) return;

    function handleOutsideClicks(event: MouseEvent) {
      const target = event.target as Node;
      if (
        menuReference.current &&
        !menuReference.current.contains(target) &&
        avatarReference.current &&
        !avatarReference.current.contains(target)
      ) {
        setShowUserMenu(false);
      }
    }

    document.addEventListener('mousedown', handleOutsideClicks);
    return () => document.removeEventListener('mousedown', handleOutsideClicks);
  }, [showUserMenu]);

  // closes main menu on Escape (covers focus outside the menu container)
  useEffect(() => {
    if (!showUserMenu) return;

    function handleEscapeKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setShowUserMenu(false);
        avatarReference.current?.focus();
      }
    }

    document.addEventListener('keydown', handleEscapeKey);
    return () => document.removeEventListener('keydown', handleEscapeKey);
  }, [showUserMenu]);

  const resetPreview = (currentBaseTheme: string) => {
    if (resetTransitionTimeout.current) {
      clearTimeout(resetTransitionTimeout.current);
    }
    setPreviewTheme(null);
    const root = document.documentElement;
    root.style.setProperty('--theme-transition-duration', '600ms');
    root.style.setProperty('--theme-transition-easing', 'ease-out');
    root.dataset.theme = currentBaseTheme;
    resetTransitionTimeout.current = setTimeout(() => {
      root.style.removeProperty('--theme-transition-duration');
      root.style.removeProperty('--theme-transition-easing');
      resetTransitionTimeout.current = null;
    }, 650);
  };

  const handlePreviewChange = (theme: BaseTheme | null) => {
    if (resetTransitionTimeout.current) {
      clearTimeout(resetTransitionTimeout.current);
      resetTransitionTimeout.current = null;
    }
    setPreviewTheme(theme);
  };

  const handleThemeRowEnter = () => {
    if (themeRowReference.current) {
      const rect = themeRowReference.current.getBoundingClientRect();
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
        className={`flex items-center gap-2 p-1.5 bg-[var(--bg-elevated)] border-shadow hover:border-shadow ${FOCUS_RING} rounded-4xl transition cursor-pointer`}
        ref={avatarReference}
        type="button"
        data-usermenu-trigger
        onClick={(event) => {
          openedByKeyboard.current = event.detail === 0;
          setShowUserMenu((open) => !open);
        }}
        aria-expanded={showUserMenu}
        aria-haspopup="menu"
        aria-label="User menu"
      >
        <img
          src={avatarUrl}
          alt={user.email}
          className="w-8 h-8 outline outline-black/10 -outline-offset-1 rounded-[26px]"
        />
        <i
          className={`fa-solid fa-chevron-down text-[var(--text-muted)] text-[0.6rem] transition-transform duration-200 ease-out ${showUserMenu ? '-rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      <div
        ref={menuReference}
        role="menu"
        aria-hidden={!showUserMenu}
        tabIndex={-1}
        className="absolute right-0 z-50 origin-top-right w-64 mt-2 py-2 bg-[var(--bg-elevated)] border-shadow text-xs rounded-lg focus:outline-none"
        style={{
          transition: `opacity ${showUserMenu ? '150ms ease-out' : '100ms ease-in'}, transform ${showUserMenu ? '150ms ease-out' : '100ms ease-in'}`,
          opacity: showUserMenu ? 1 : 0,
          transform: showUserMenu ? 'scale(1)' : 'scale(0.95)',
          pointerEvents: showUserMenu ? 'auto' : 'none',
        }}
        onMouseLeave={() => menuReference.current?.focus()}
      >
        <div onMouseEnter={() => menuReference.current?.focus()}>
          <MenuSection label="Logged in as" className="px-3">
            <p className="mt-0.5 text-[var(--text)] text-xs tracking-tight font-medium truncate">
              {user.email}
            </p>
          </MenuSection>
        </div>

        <MenuSection>
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

          <MenuItem
            icon="fa-palette"
            label="Theme editor"
            onClick={() => {
              onViewChange('theme-editor');
              setShowUserMenu(false);
            }}
            active={view === 'theme-editor'}
          />
        </MenuSection>

        <MenuSection>
          <div
            ref={themeRowReference}
            className="relative"
            onMouseEnter={() => {
              setIsThemeAreaPointerOver(true);
              handleThemeRowEnter();
            }}
            onMouseLeave={() => setIsThemeAreaPointerOver(false)}
          >
            <ThemeSubmenu
              baseTheme={baseTheme}
              previewTheme={previewTheme}
              showSubmenu={showThemeSubmenu}
              submenuOnLeft={themeSubmenuOnLeft}
              isPointerOver={isThemeAreaPointerOver}
              flyoutReference={flyoutReference}
              onTriggerBlur={() => {
                setShowThemeSubmenu(false);
                if (previewTheme !== null) {
                  resetPreview(baseTheme);
                }
              }}
              onFlyoutBlur={(relatedTarget) => {
                if (!themeRowReference.current?.contains(relatedTarget)) {
                  setShowThemeSubmenu(false);
                  if (previewTheme !== null) {
                    resetPreview(baseTheme);
                  }
                }
              }}
              onTriggerClick={handleThemeRowEnter}
              onKeyboardOpen={() => {
                submenuOpenedByKeyboard.current = true;
              }}
              onPreviewChange={handlePreviewChange}
              onSelect={handleThemeSelect}
            />
          </div>
        </MenuSection>

        <MenuItem
          icon="fa-right-from-bracket"
          label="Log out"
          onClick={() => {
            setShowUserMenu(false);
            onLogout();
          }}
          className="mt-2"
        />
      </div>
    </div>
  );
}
