import InlineThemeList from './InlineThemeList';
import MenuItem from './MenuItem';
import MenuSection from './MenuSection';
import NavMenuItems from './NavMenuItems';
import { useEffect, useRef, useState } from 'react';
import { useMenuNavigation } from './useMenuNavigation';
import { THEMES } from '../../theme/ThemeContext';
import type { AppView } from '../../lib/navigation';
import type { BaseTheme, Mode } from '../../theme/ThemeContext';
import type { User } from '../../auth/AuthContext';

interface MobileBottomSheetProps {
  user: User;
  view: AppView;
  isOpen: boolean;
  baseTheme: BaseTheme;
  mode: Mode;
  onClose: () => void;
  onLogout: () => void;
  onModeToggle: () => void;
  onThemeSelect: (theme: BaseTheme) => void;
  onViewChange: (view: AppView) => void;
}

/**
 * Bottom sheet that slides up from the screen edge on mobile.
 *
 * A semi-transparent scrim covers the page behind the sheet. Tapping the
 * scrim or swiping the drag handle downward closes the sheet. A
 * `menu-open` class is toggled on `document.body` (mobile only) to prevent
 * background scroll — the desktop dropdown shares the same `isOpen` state,
 * so the media-query guard in `index.css` keeps scroll unlocked on larger
 * screens.
 *
 * The sheet contains two views that alternate via CSS grid 0fr/1fr:
 * - Main view: nav items, theme trigger row, and logout.
 * - Theme subview: a back button and the flat theme list.
 *
 * Both views are always mounted; `inert` is applied to the off-screen one
 * so keyboard/pointer events only reach the visible view.
 */
export default function MobileBottomSheet({
  user,
  view,
  isOpen,
  baseTheme,
  mode,
  onClose,
  onLogout,
  onModeToggle,
  onThemeSelect,
  onViewChange,
}: MobileBottomSheetProps) {
  const [showThemeSubview, setShowThemeSubview] = useState(false);
  const mainViewReference = useRef<HTMLDivElement | null>(null);
  const themeViewReference = useRef<HTMLDivElement | null>(null);
  const themeButtonReference = useRef<HTMLButtonElement | null>(null);
  const touchStartY = useRef(0);

  useMenuNavigation(mainViewReference, onClose);
  useMenuNavigation(themeViewReference, handleBackToMain);

  useEffect(() => {
    const isMobile =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(max-width: 767px)').matches;

    if (isOpen && isMobile) {
      document.body.classList.add('menu-open');
    } else {
      document.body.classList.remove('menu-open');
    }

    return () => {
      document.body.classList.remove('menu-open');
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const firstItem =
      mainViewReference.current?.querySelector<HTMLElement>(
        '[role="menuitem"]',
      );
    (firstItem ?? mainViewReference.current)?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!showThemeSubview) return;
    requestAnimationFrame(() => {
      const firstItem =
        themeViewReference.current?.querySelector<HTMLElement>(
          '[role="menuitem"]',
        );
      (firstItem ?? themeViewReference.current)?.focus({ preventScroll: true });
    });
  }, [showThemeSubview]);

  function handleSheetTransitionEnd(
    event: React.TransitionEvent<HTMLDivElement>,
  ) {
    if (event.propertyName === 'transform' && !isOpen) {
      setShowThemeSubview(false);
    }
  }

  function handleBackToMain() {
    setShowThemeSubview(false);
    requestAnimationFrame(() => themeButtonReference.current?.focus());
  }

  function handleThemeSelect(theme: BaseTheme) {
    onThemeSelect(theme);
  }

  function handleDragHandleTouchStart(event: React.TouchEvent) {
    touchStartY.current = event.touches[0].clientY;
  }

  function handleDragHandleTouchEnd(event: React.TouchEvent) {
    const deltaY = event.changedTouches[0].clientY - touchStartY.current;
    if (deltaY > 64) {
      onClose();
    }
  }

  const currentThemeLabel = THEMES.find(
    (theme) => theme.id === baseTheme,
  )?.label;

  return (
    <div className="md:hidden">
      <div
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden="true"
        onClick={onClose}
      />

      {/* FIME: replace custom box-shadow with Tailwind style */}
      <div
        className="fixed bottom-0 inset-x-0 z-50 max-h-[85svh] overflow-y-auto bg-[var(--bg-elevated)] rounded-t-2xl pb-[env(safe-area-inset-bottom)]"
        style={{
          transform: isOpen ? 'translateY(0)' : 'translateY(100%)',
          transition: `transform ${isOpen ? '300ms ease-out' : '250ms ease-in'}`,
          overscrollBehavior: 'contain',
          boxShadow: '0 -4px 32px rgba(0,0,0,0.12)',
        }}
        role="dialog"
        aria-modal="true"
        aria-label="User menu"
        inert={!isOpen ? true : undefined}
        onTransitionEnd={handleSheetTransitionEnd}
      >
        <div
          className="sticky top-0 z-10 flex justify-center pt-3 pb-2 bg-[var(--bg-elevated)] cursor-grab active:cursor-grabbing"
          onTouchStart={handleDragHandleTouchStart}
          onTouchEnd={handleDragHandleTouchEnd}
        >
          <div
            className="w-10 h-1 rounded-full bg-[var(--border)]"
            aria-hidden="true"
          />
        </div>

        <div style={{ clipPath: 'inset(0)' }}>
          <div
            style={{
              display: 'flex',
              width: '200%',
              transform: showThemeSubview
                ? 'translateX(-50%)'
                : 'translateX(0)',
              transition: 'transform 300ms cubic-bezier(0.4, 0, 0.2, 1)',
              alignItems: 'flex-start',
              willChange: 'transform',
            }}
          >
            <div
              style={{ width: '50%' }}
              role="menu"
              aria-label="User menu"
              tabIndex={-1}
              ref={mainViewReference}
              className="pb-4"
              inert={showThemeSubview ? true : undefined}
            >
              {/* FIXME: align this bottom divider with the themes submenu divider */}
              <MenuSection label="Logged in as" className="px-4 pt-2">
                <p className="mt-0.5 text-[var(--text)] text-xs tracking-tight font-medium truncate">
                  {user.email}
                </p>
              </MenuSection>

              <NavMenuItems
                mode={mode}
                view={view}
                onClose={onClose}
                onModeToggle={onModeToggle}
                onViewChange={onViewChange}
              />

              <MenuSection>
                <button
                  ref={themeButtonReference}
                  type="button"
                  role="menuitem"
                  aria-haspopup="menu"
                  aria-expanded={showThemeSubview}
                  className="flex items-center gap-2 w-full pl-2.5 pr-3 py-2 focus:outline-none text-[var(--text)] text-left cursor-pointer"
                  onMouseEnter={(event) => event.currentTarget.focus()}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => setShowThemeSubview(true)}
                >
                  <i
                    className="fa-solid fa-palette text-[var(--text-muted)] text-[0.75rem]"
                    aria-hidden="true"
                  />
                  <div className="flex-1">
                    <div>Theme</div>
                    <div className="mt-0.5 text-[var(--text-muted)] line-clamp-1">
                      {currentThemeLabel}
                    </div>
                  </div>
                  <i
                    className="fa-solid fa-chevron-right text-[var(--text-subtle)] text-[0.6rem]"
                    aria-hidden="true"
                  />
                </button>
              </MenuSection>

              {/* FIXME: worth subclassing MenuItem for MobileMenuItem (?) */}
              <MenuItem
                icon="fa-right-from-bracket"
                label="Log out"
                className="mt-2 focus:bg-transparent!"
                onClick={() => {
                  onLogout();
                  onClose();
                }}
              />
            </div>

            <div
              style={{ width: '50%' }}
              role="menu"
              aria-label="Theme"
              tabIndex={-1}
              ref={themeViewReference}
              className="pb-4"
              inert={!showThemeSubview ? true : undefined}
            >
              {/* FIXME: align this bottom divider with the user menu divider */}
              <MenuSection className="flex items-center justify-between">
                <MenuItem
                  icon="fa-chevron-left"
                  label=""
                  aria-label="Back to main menu"
                  className="flex-0 focus:bg-transparent!"
                  onClick={handleBackToMain}
                />
                <p className="font-semibold">Themes</p>
                {/* Non-interactive width-matching spacer so the heading stays
                    visually centered. Replaces an empty `MenuItem` that sat
                    in the tab order with no accessible name. */}
                <div aria-hidden="true" className="flex-0 w-9" />
              </MenuSection>

              <InlineThemeList
                baseTheme={baseTheme}
                onSelect={handleThemeSelect}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
