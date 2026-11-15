import InlineThemeList from './InlineThemeList';
import MenuItem from './MenuItem';
import MenuSection from './MenuSection';
import type { BaseTheme } from '../../theme/ThemeContext';
import type { RefObject } from 'react';

interface BottomSheetThemeSubmenuProps {
  baseTheme: BaseTheme;
  showThemeSubview: boolean;
  panelReference: RefObject<HTMLDivElement | null>;
  onBack: () => void;
  onThemeSelect: (theme: BaseTheme) => void;
}

/**
 * The theme-picker subview of the mobile bottom sheet. Rendered inside the
 * shell's slide track alongside `BottomSheetMainPanel`.
 *
 * `panelReference` is owned by `MobileBottomSheet` and passed down so
 * `useMenuNavigation` and the focus-on-open effect target the correct node.
 * `inert` is applied when the subview is off-screen so keyboard/pointer
 * events only reach the visible panel.
 */
export default function BottomSheetThemeSubmenu({
  baseTheme,
  showThemeSubview,
  panelReference,
  onBack,
  onThemeSelect,
}: BottomSheetThemeSubmenuProps) {
  return (
    <div
      style={{ width: '50%' }}
      role="menu"
      aria-label="Theme"
      tabIndex={-1}
      ref={panelReference}
      className="pb-4"
      inert={!showThemeSubview ? true : undefined}
    >
      <MenuSection className="grid grid-cols-[1fr_auto_1fr] items-center">
        <MenuItem
          icon="fa-chevron-left"
          label=""
          aria-label="Back to main menu"
          fullWidth={false}
          onClick={onBack}
        />
        <p className="font-semibold">Themes</p>
      </MenuSection>

      <InlineThemeList baseTheme={baseTheme} onSelect={onThemeSelect} />
    </div>
  );
}
