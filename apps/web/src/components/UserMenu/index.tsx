import { gravatarUrl } from '../../lib/gravatar';
import { FOCUS_RING, menuRevealStyle } from '../../lib/styles';
import { forwardRef, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useTheme, type BaseTheme } from '../../theme/ThemeContext';
import MenuSection from './MenuSection';
import MenuItem from './MenuItem';
import NavMenuItems from './NavMenuItems';
import ThemeSubmenu from './ThemeSubmenu';
import { useMenuNavigation } from './useMenuNavigation';
import { useThemePreview } from './useThemePreview';
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

  const {
    clearResetHandles,
    flyoutReference,
    handlePreviewChange,
    handleThemeRowEnter,
    isThemeAreaPointerOver,
    previewTheme,
    setIsThemeAreaPointerOver,
    setShowThemeSubmenu,
    showThemeSubmenu,
    submenuOpenedByKeyboard,
    themeRowReference,
    themeSubmenuOnLeft,
    resetPreview,
  } = useThemePreview();

  // When the base theme actually commits (ThemeContext useLayoutEffect has
  // already written the new data-theme), cancel any in-flight reset rAF so a
  // stale closure value cannot overwrite the freshly selected theme.
  useLayoutEffect(() => {
    clearResetHandles();
  }, [baseTheme, clearResetHandles]);

  const avatarReference = useRef<HTMLButtonElement | null>(null);
  const menuReference = useRef<HTMLDivElement | null>(null);
  const openedByKeyboard = useRef(false);

  useMenuNavigation(menuReference, () => {
    onClose();
    avatarReference.current?.focus();
  });

  const closeFlyout = () => {
    setShowThemeSubmenu(false);
    if (previewTheme !== null) {
      resetPreview(baseTheme);
    }
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
  }, [isOpen, setIsThemeAreaPointerOver, setShowThemeSubmenu]);

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
        aria-label={`User menu (${user.email})`}
      >
        <img
          src={avatarUrl}
          alt=""
          aria-hidden="true"
          className="w-8 h-8 outline outline-black/10 -outline-offset-1 rounded-[26px]"
        />
        <span className="hidden sm:inline-flex">
          <i
            className={`fa-solid fa-chevron-down text-[var(--text-muted)] text-[0.6rem] transition-transform duration-200 ease-out ${isOpen ? '-rotate-180' : ''}`}
            aria-hidden="true"
          />
        </span>
      </button>

      <div
        ref={menuReference}
        role="menu"
        aria-hidden={!isOpen}
        tabIndex={-1}
        inert={!isOpen ? true : undefined}
        className="hidden md:block absolute right-0 z-50 origin-top-right w-64 mt-2 py-2 bg-[var(--bg-elevated)] border-shadow text-xs rounded-lg focus:outline-none"
        style={menuRevealStyle(isOpen)}
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

        <NavMenuItems
          mode={mode}
          view={view}
          onClose={onClose}
          onModeToggle={onModeToggle}
          onViewChange={onViewChange}
        />

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
            onLogout();
            onClose();
          }}
          className="mt-2"
        />
      </div>
    </div>
  );
});

export default UserMenu;
