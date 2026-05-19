import InlineThemeList from './InlineThemeList';
import MenuItem from './MenuItem';
import MenuSection from './MenuSection';
import NavMenuItems from './NavMenuItems';
import { menuRevealStyle } from '../../lib/styles';
import { useEffect, useRef } from 'react';
import { useMenuNavigation } from './useMenuNavigation';
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
 * The panel is always mounted and hidden via `aria-hidden` + `inert` rather
 * than conditionally rendered. This lets the CSS transition play on open and
 * close without requiring an unmount/remount cycle. The outer `div` carries
 * `aria-hidden` so screen readers skip the panel when it is closed; `inert`
 * prevents keyboard focus from reaching its children.
 *
 * Theme selection uses `InlineThemeList` (a flat list) instead of the desktop
 * flyout because mobile has no reliable hover state for live preview.
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
  const panelReference = useRef<HTMLDivElement | null>(null);

  useMenuNavigation(panelReference, onClose);

  useEffect(() => {
    if (isOpen) {
      const firstItem =
        panelReference.current?.querySelector<HTMLElement>('[role="menuitem"]');
      if (firstItem) {
        firstItem.focus();
      } else {
        panelReference.current?.focus();
      }
    }
  }, [isOpen]);

  return (
    <div
      className="md:hidden border-b border-[var(--border)]"
      aria-hidden={!isOpen}
      inert={!isOpen ? true : undefined}
      style={menuRevealStyle(isOpen, 'translateY(0)', 'translateY(-8px)')}
    >
      <div
        role="menu"
        aria-label="User menu"
        tabIndex={-1}
        ref={panelReference}
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

        <MenuSection label="Theme" labelClassName="px-4 pt-3 pb-1">
          <InlineThemeList
            baseTheme={baseTheme}
            onSelect={(theme) => {
              onThemeSelect(theme);
              onClose();
            }}
          />
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
}
