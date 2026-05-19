import { gravatarUrl } from '../../lib/gravatar';
import { FOCUS_RING } from '../../lib/styles';
import { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import { useTheme, type BaseTheme } from '../../theme/ThemeContext';
import MenuSection from './MenuSection';
import MenuItem from './MenuItem';
import ThemeSubmenu from './ThemeSubmenu';
import { useMenuNavigation } from './useMenuNavigation';
import type { AppView } from '../../lib/navigation';
import type { User } from '../../auth/AuthContext';

interface UserMenuProps {
  user: User;
  view: AppView;
  /** Whether the menu is open. Controlled by Header. */
  isOpen: boolean;
  /** Called when the avatar button is clicked. */
  onToggle: () => void;
  /** Called to imperatively close the menu (e.g. after nav item selection). */
  onClose: () => void;
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
 * - `showThemeSubmenu` — whether the theme flyout is visible.
 * - `previewTheme` — the theme currently being previewed on hover.
 * - `themeSubmenuOnLeft` — whether the flyout opens left (when near the right edge).
 * - `isThemeAreaPointerOver` — whether the mouse is over the theme row + flyout area.
 *
 * Open/close state (`isOpen`) is owned by `Header` and passed as a prop.
 * `Header` also owns the outside-click and Escape listeners that close the menu.
 *
 * The theme submenu stays open until the user mouses over another menu item or
 * closes the main menu. Hover tracking uses the `themeRowReference` wrapper div
 * (which contains both the trigger row and the flyout panel) so the submenu does
 * not close when moving between the two.
 *
 * Keyboard navigation within the dropdown is handled by `useMenuNavigation`.
 *
 * The Gravatar URL is memoized so it only recomputes when `user.email` changes.
 */
const UserMenu = forwardRef<HTMLButtonElement, UserMenuProps>(function UserMenu(
  {
    user,
    view,
    isOpen,
    onToggle,
    onClose,
    onLogout,
    onModeToggle,
    onThemeSelect,
    onViewChange,
  },
  forwardedReference,
) {
  const avatarUrl = useMemo(() => gravatarUrl(user.email, 64), [user.email]);
  const { baseTheme, mode } = useTheme();

  const [isThemeAreaPointerOver, setIsThemeAreaPointerOver] = useState(false);
  const [previewTheme, setPreviewTheme] = useState<string | null>(null);
  const [showThemeSubmenu, setShowThemeSubmenu] = useState(false);
  const [themeSubmenuOnLeft, setThemeSubmenuOnLeft] = useState(true);

  const avatarReference = useRef<HTMLButtonElement | null>(null);
  const flyoutReference = useRef<HTMLDivElement | null>(null);
  const menuReference = useRef<HTMLDivElement | null>(null);
  const openedByKeyboard = useRef(false);
  const resetRafHandle = useRef<number | null>(null);
  const resetTransitionTimeout = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const submenuOpenedByKeyboard = useRef(false);
  const themeRowReference = useRef<HTMLDivElement | null>(null);

  useMenuNavigation(menuReference, () => {
    onClose();
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
    if (!isOpen) {
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
  }, [isOpen]);

  // auto-focuses first flyout item when submenu opens via keyboard
  useEffect(() => {
    if (!showThemeSubmenu || !submenuOpenedByKeyboard.current) return;
    submenuOpenedByKeyboard.current = false;
    const firstItem = flyoutReference.current?.querySelector<HTMLElement>(
      '[data-submenu-item]',
    );
    firstItem?.focus();
  }, [showThemeSubmenu]);

  const resetPreview = (currentBaseTheme: string) => {
    if (resetTransitionTimeout.current) {
      clearTimeout(resetTransitionTimeout.current);
      resetTransitionTimeout.current = null;
    }
    if (resetRafHandle.current) {
      cancelAnimationFrame(resetRafHandle.current);
    }
    setPreviewTheme(null);
    const root = document.documentElement;
    // Defer CSS var mutations to rAF so React re-renders first (removing the
    // Theme row highlight instantly) before the 600ms transition is applied.
    resetRafHandle.current = requestAnimationFrame(() => {
      resetRafHandle.current = null;
      root.style.setProperty('--theme-transition-duration', '600ms');
      root.style.setProperty('--theme-transition-easing', 'ease-out');
      root.dataset.theme = currentBaseTheme;
      resetTransitionTimeout.current = setTimeout(() => {
        root.style.removeProperty('--theme-transition-duration');
        root.style.removeProperty('--theme-transition-easing');
        resetTransitionTimeout.current = null;
      }, 650);
    });
  };

  const handlePreviewChange = (theme: BaseTheme | null) => {
    if (resetTransitionTimeout.current) {
      clearTimeout(resetTransitionTimeout.current);
      resetTransitionTimeout.current = null;
    }
    if (resetRafHandle.current) {
      cancelAnimationFrame(resetRafHandle.current);
      resetRafHandle.current = null;
    }
    setPreviewTheme(theme);
  };

  const handleThemeRowEnter = () => {
    if (resetRafHandle.current) {
      cancelAnimationFrame(resetRafHandle.current);
      resetRafHandle.current = null;
    }
    if (themeRowReference.current) {
      const rect = themeRowReference.current.getBoundingClientRect();
      // submenu is w-56 (224px) + an 8px safety margin
      setThemeSubmenuOnLeft(rect.right + 224 + 8 > window.innerWidth);
    }
    setShowThemeSubmenu(true);
  };

  const handleThemeSelect = (theme: BaseTheme) => {
    onThemeSelect(theme);
    onClose();
  };

  return (
    <div className="relative">
      <button
        className={`flex items-center gap-2 p-1.5 bg-[var(--bg-elevated)] border-shadow hover:border-shadow ${FOCUS_RING} rounded-4xl transition cursor-pointer`}
        ref={(node) => {
          avatarReference.current = node;
          if (typeof forwardedReference === 'function') {
            forwardedReference(node);
          } else if (forwardedReference) {
            forwardedReference.current = node;
          }
        }}
        type="button"
        data-usermenu-trigger
        onClick={(event) => {
          openedByKeyboard.current = event.detail === 0;
          onToggle();
        }}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label="User menu"
      >
        <img
          src={avatarUrl}
          alt={user.email}
          className="w-8 h-8 outline outline-black/10 -outline-offset-1 rounded-[26px]"
        />
        <i
          className={`fa-solid fa-chevron-down text-[var(--text-muted)] text-[0.6rem] transition-transform duration-200 ease-out ${isOpen ? '-rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      <div
        ref={menuReference}
        role="menu"
        aria-hidden={!isOpen}
        tabIndex={-1}
        className="absolute right-0 z-50 origin-top-right w-64 mt-2 py-2 bg-[var(--bg-elevated)] border-shadow text-xs rounded-lg focus:outline-none"
        style={{
          transition: `opacity ${isOpen ? '150ms ease-out' : '100ms ease-in'}, transform ${isOpen ? '150ms ease-out' : '100ms ease-in'}`,
          opacity: isOpen ? 1 : 0,
          transform: isOpen ? 'scale(1)' : 'scale(0.95)',
          pointerEvents: isOpen ? 'auto' : 'none',
        }}
        onMouseLeave={() => {
          if (!themeRowReference.current?.contains(document.activeElement)) {
            menuReference.current?.focus();
          }
        }}
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
              onClose();
            }}
            active={view === 'links'}
          />

          <MenuItem
            icon="fa-gear"
            label="Settings"
            onClick={() => {
              onViewChange('settings');
              onClose();
            }}
            active={view === 'settings'}
          />

          <MenuItem
            icon={mode === 'light' ? 'fa-moon' : 'fa-sun'}
            label={`Switch to ${mode === 'light' ? 'dark' : 'light'} mode`}
            onClick={onModeToggle}
          />

          <MenuItem
            icon="fa-paintbrush"
            label="Theme editor"
            onClick={() => {
              onViewChange('theme-editor');
              onClose();
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
            onMouseLeave={(event) => {
              setIsThemeAreaPointerOver(false);
              if (previewTheme !== null) {
                resetPreview(baseTheme);
              }
              if (
                menuReference.current?.contains(event.relatedTarget as Node)
              ) {
                setShowThemeSubmenu(false);
              } else if (
                !flyoutReference.current?.contains(document.activeElement)
              ) {
                setShowThemeSubmenu(false);
                menuReference.current?.focus();
              }
            }}
          >
            <ThemeSubmenu
              baseTheme={baseTheme}
              previewTheme={previewTheme}
              showSubmenu={showThemeSubmenu}
              submenuOnLeft={themeSubmenuOnLeft}
              isPointerOver={isThemeAreaPointerOver || showThemeSubmenu}
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
            onClose();
            onLogout();
          }}
          className="mt-2"
        />
      </div>
    </div>
  );
});

export default UserMenu;
