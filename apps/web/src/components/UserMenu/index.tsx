import { FOCUS_RING, menuRevealStyle } from '../../lib/styles';
import { forwardRef, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { gravatarUrl } from '../../lib/gravatar';
import MenuItem from './MenuItem';
import MenuSection from './MenuSection';
import NavMenuItems from './NavMenuItems';
import ThemeSubmenu from './ThemeSubmenu';
import { useMenuNavigation } from './useMenuNavigation';
import { useTheme, type BaseTheme } from '../../theme/ThemeContext';
import { useThemePreview } from './useThemePreview';
import type { AppView } from '../../lib/navigation';
import type { User } from '../../auth/AuthContext';

interface UserMenuProps {
  user: User;
  view: AppView;
  isOpen: boolean;
  onToggle: () => void;
  // imperative close, e.g. after nav item selection
  onClose: () => void;
  onLogout: () => void;
  onModeToggle: () => void;
  onThemeSelect: (theme: BaseTheme) => void;
  onViewChange: (view: AppView) => void;
}

/**
 * Avatar button that opens a dropdown menu with navigation, theme/mode
 * controls, and logout. Mouse and keyboard navigable.
 *
 * Open/close state (`isOpen`) is owned by `Header`, which also owns the
 * outside-click and Escape listeners that close the menu.
 *
 * The theme submenu stays open until the user mouses over another menu item
 * or closes the main menu. Hover tracking uses the `themeRowReference` wrapper
 * div (which contains both the trigger row and the flyout panel) so the
 * submenu does not close when moving between the two.
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
  const { baseTheme, customTheme, mode } = useTheme();

  const {
    applyPreview,
    clearResetHandles,
    flyoutReference,
    handleThemeRowEnter,
    previewTheme,
    setShowThemeSubmenu,
    showThemeSubmenu,
    submenuOpenedByKeyboard,
    themeRowReference,
    themeSubmenuOnLeft,
    resetPreview,
  } = useThemePreview(customTheme, mode);

  // cancel the in-flight reset rAF on commit so a stale closure can't win
  useLayoutEffect(() => {
    clearResetHandles();
  }, [baseTheme, clearResetHandles]);

  const avatarReference = useRef<HTMLButtonElement | null>(null);
  const menuReference = useRef<HTMLDivElement | null>(null);
  const openedByKeyboard = useRef(false);

  useMenuNavigation(
    menuReference,
    () => {
      onClose();
      avatarReference.current?.focus();
    },
    // Escape refocuses avatar; Tab must not (fights native tab), SC 2.4.3
    { onTabClose: onClose },
  );

  const resetPreviewIfActive = () => {
    if (previewTheme !== null) {
      resetPreview(baseTheme);
    }
  };

  const closeFlyout = () => {
    setShowThemeSubmenu(false);
    resetPreviewIfActive();
    menuReference.current
      ?.querySelector<HTMLElement>('[aria-haspopup="menu"]')
      ?.focus();
  };

  // Tab must not refocus the trigger (fights native tab order), SC 2.4.3
  const closeFlyoutOnTab = () => {
    setShowThemeSubmenu(false);
    resetPreviewIfActive();
  };

  useMenuNavigation(flyoutReference, closeFlyout, {
    itemSelector: '[data-submenu-item]',
    onArrowLeft: closeFlyout,
    onTabClose: closeFlyoutOnTab,
  });

  // resets submenu when main menu closes; moves focus into menu on open
  useEffect(() => {
    if (!isOpen) {
      setShowThemeSubmenu(false);
      return;
    }
    if (openedByKeyboard.current) {
      // keyboard open: focus first item so arrow-key nav starts immediately
      const firstItem =
        menuReference.current?.querySelector<HTMLElement>('[role="menuitem"]');
      firstItem?.focus();
    } else {
      // mouse open: focus container so keydowns reach nav, no pre-select
      menuReference.current?.focus();
    }
  }, [isOpen, setShowThemeSubmenu]);

  const handleThemeSelect = (theme: BaseTheme) => {
    onThemeSelect(theme);
    onClose();
  };

  // keep the local ref in sync with either forwarded ref shape
  const mergeAvatarReference = (node: HTMLButtonElement | null) => {
    avatarReference.current = node;
    if (typeof forwardedReference === 'function') {
      forwardedReference(node);
    } else if (forwardedReference) {
      forwardedReference.current = node;
    }
  };

  return (
    <div className="relative">
      <button
        className={`group flex items-center gap-2 p-1.5 bg-[var(--orbit-bg)] border-shadow hover:border-shadow ${FOCUS_RING} rounded-4xl transition cursor-pointer`}
        ref={mergeAvatarReference}
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
          className="safe-themed-asset w-8 h-8 outline outline-black/10 -outline-offset-1 rounded-[26px]"
        />
        <span className="hidden sm:inline-flex">
          <i
            className="fa-solid fa-chevron-down text-[var(--orbit-alt-text)] text-[0.6rem] group-aria-expanded:-rotate-180 transition-transform duration-200 ease-out"
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
        className="hidden md:block absolute right-0 z-50 origin-top-right w-64 mt-2 py-2 bg-[var(--orbit-bg)] border-shadow text-xs rounded-lg focus:outline-none"
        style={menuRevealStyle(isOpen)}
        onMouseLeave={() => {
          if (!themeRowReference.current?.contains(document.activeElement)) {
            menuReference.current?.focus();
          }
        }}
      >
        <div onMouseEnter={() => menuReference.current?.focus()}>
          <MenuSection label="Logged in as" className="px-3">
            <p className="mt-0.5 text-[var(--orbit-text)] text-xs tracking-tight font-medium truncate">
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
            onMouseEnter={handleThemeRowEnter}
            onMouseLeave={(event) => {
              resetPreviewIfActive();
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
              flyoutReference={flyoutReference}
              onTriggerBlur={() => {
                setShowThemeSubmenu(false);
                resetPreviewIfActive();
              }}
              onFlyoutBlur={(relatedTarget) => {
                if (!themeRowReference.current?.contains(relatedTarget)) {
                  setShowThemeSubmenu(false);
                  resetPreviewIfActive();
                }
              }}
              onTriggerClick={handleThemeRowEnter}
              onKeyboardOpen={() => {
                submenuOpenedByKeyboard.current = true;
              }}
              onApplyPreview={applyPreview}
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
