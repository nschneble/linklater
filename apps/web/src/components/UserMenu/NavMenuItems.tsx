import MenuItem from './MenuItem';
import MenuSection from './MenuSection';
import type { AppView } from '../../lib/navigation';
import type { Mode } from '../../theme/ThemeContext';

interface NavMenuItemsProps {
  mode: Mode;
  view: AppView;
  onClose: () => void;
  onModeToggle: () => void;
  onViewChange: (view: AppView) => void;
}

/**
 * The four shared navigation items rendered in both the desktop `UserMenu`
 * dropdown and the mobile `MobileMenuPanel`: Your links, Settings, mode
 * toggle, and Theme editor. Wrapped in a `MenuSection`.
 *
 * The theme picker row is intentionally excluded here because the desktop
 * uses a flyout `ThemeSubmenu` while mobile uses a flat `InlineThemeList`.
 */
export default function NavMenuItems({
  mode,
  view,
  onClose,
  onModeToggle,
  onViewChange,
}: NavMenuItemsProps) {
  return (
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
  );
}
