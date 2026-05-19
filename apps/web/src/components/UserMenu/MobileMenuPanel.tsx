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

interface MobileMenuPanelProps {
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
 * Full-width menu panel that slides down below the header on mobile.
 *
 * The panel uses a CSS grid `0fr → 1fr` transition to animate open/close
 * without needing to measure height. The border lives inside the clipped
 * area so it fades with the content rather than popping on/off instantly.
 *
 * Internally the panel has two views that alternate via the same grid trick:
 * - Main view: nav items, a theme trigger row, and logout.
 * - Theme subview: a back button and the flat theme list.
 *
 * When switching views, the active panel expands (0fr → 1fr) while the
 * inactive panel collapses (1fr → 0fr) simultaneously. Both panels are
 * always mounted; `inert` is applied to the off-screen one so keyboard/
 * pointer events can only reach the visible panel.
 */
export default function MobileMenuPanel({
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
}: MobileMenuPanelProps) {
  const [showThemeSubview, setShowThemeSubview] = useState(false);
  const mainViewReference = useRef<HTMLDivElement | null>(null);
  const themeViewReference = useRef<HTMLDivElement | null>(null);
  const themeButtonReference = useRef<HTMLButtonElement | null>(null);

  useMenuNavigation(mainViewReference, onClose);
  useMenuNavigation(themeViewReference, handleBackToMain);

  useEffect(() => {
    if (!isOpen) {
      setShowThemeSubview(false);
      return;
    }
    const firstItem =
      mainViewReference.current?.querySelector<HTMLElement>('[role="menuitem"]');
    (firstItem ?? mainViewReference.current)?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!showThemeSubview) return;
    const firstItem =
      themeViewReference.current?.querySelector<HTMLElement>('[role="menuitem"]');
    (firstItem ?? themeViewReference.current)?.focus();
  }, [showThemeSubview]);

  function handleBackToMain() {
    setShowThemeSubview(false);
    requestAnimationFrame(() => themeButtonReference.current?.focus());
  }

  function handleThemeSelect(theme: BaseTheme) {
    onThemeSelect(theme);
    onClose();
  }

  const currentThemeLabel = THEMES.find(
    (theme) => theme.id === baseTheme,
  )?.label;

  return (
    <div
      className={`md:hidden grid ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
      style={{
        transition: `grid-template-rows ${isOpen ? '150ms ease-out' : '100ms ease-in'}`,
      }}
      aria-hidden={!isOpen}
      inert={!isOpen ? true : undefined}
    >
      <div className="overflow-hidden">
        <div className="border-b border-[var(--border)]">
          {/* Main view */}
          <div
            className="grid"
            style={{
              gridTemplateRows: showThemeSubview ? '0fr' : '1fr',
              transition: `grid-template-rows ${showThemeSubview ? '150ms ease-in' : '150ms ease-out 150ms'}`,
            }}
            inert={showThemeSubview ? true : undefined}
          >
            <div className="overflow-hidden">
              <div
                role="menu"
                aria-label="User menu"
                tabIndex={-1}
                ref={mainViewReference}
                className="pb-2"
              >
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
                    className="flex items-center gap-2 w-full pl-2.5 pr-3 py-2 focus:bg-[var(--bg-surface)] focus:outline-none text-[var(--text)] text-left cursor-pointer"
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
          </div>

          {/* Theme subview */}
          <div
            className="grid"
            style={{
              gridTemplateRows: showThemeSubview ? '1fr' : '0fr',
              transition: `grid-template-rows ${showThemeSubview ? '150ms ease-out 150ms' : '150ms ease-in'}`,
            }}
            inert={!showThemeSubview ? true : undefined}
          >
            <div className="overflow-hidden">
              <div
                role="menu"
                aria-label="Theme"
                tabIndex={-1}
                ref={themeViewReference}
                className="pb-2"
              >
                <MenuSection>
                  <button
                    type="button"
                    role="menuitem"
                    className="flex items-center gap-2 w-full pl-2.5 pr-3 py-2 focus:bg-[var(--bg-surface)] focus:outline-none text-[var(--text)] text-left cursor-pointer"
                    onMouseEnter={(event) => event.currentTarget.focus()}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={handleBackToMain}
                  >
                    <i
                      className="fa-solid fa-chevron-left text-[var(--text-muted)] text-[0.6rem]"
                      aria-hidden="true"
                    />
                    <span>Back</span>
                  </button>
                </MenuSection>

                <InlineThemeList baseTheme={baseTheme} onSelect={handleThemeSelect} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
