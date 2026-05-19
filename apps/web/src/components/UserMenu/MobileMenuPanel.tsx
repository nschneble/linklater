import InlineThemeList from './InlineThemeList';
import MenuItem from './MenuItem';
import MenuSection from './MenuSection';
import { useEffect, useRef } from 'react';
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

  useEffect(() => {
    if (isOpen) {
      panelReference.current?.focus();
    }
  }, [isOpen]);

  return (
    <div
      className="md:hidden border-b border-[var(--border)]"
      aria-hidden={!isOpen}
      style={{
        transition: `opacity ${isOpen ? '150ms ease-out' : '100ms ease-in'}, transform ${isOpen ? '150ms ease-out' : '100ms ease-in'}`,
        opacity: isOpen ? 1 : 0,
        transform: isOpen ? 'translateY(0)' : 'translateY(-8px)',
        pointerEvents: isOpen ? 'auto' : 'none',
      }}
    >
      <div role="menu" tabIndex={-1} ref={panelReference} className="pb-2">
        <MenuSection label="Logged in as" className="px-4 pt-2">
          <p className="mt-0.5 text-[var(--text)] text-xs tracking-tight font-medium truncate">
            {user.email}
          </p>
        </MenuSection>

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
