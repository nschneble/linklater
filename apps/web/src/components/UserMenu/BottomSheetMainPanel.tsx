import { THEMES } from '../../theme/ThemeContext';
import { FOCUS_RING } from '../../lib/styles';
import MenuItem from './MenuItem';
import MenuSection from './MenuSection';
import NavMenuItems from './NavMenuItems';
import type { AppView } from '../../lib/navigation';
import type { BaseTheme, Mode } from '../../theme/ThemeContext';
import type { RefObject } from 'react';
import type { User } from '../../auth/AuthContext';

interface BottomSheetMainPanelProps {
  user: User;
  view: AppView;
  baseTheme: BaseTheme;
  mode: Mode;
  showThemeSubview: boolean;
  panelReference: RefObject<HTMLDivElement | null>;
  themeButtonReference: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  onLogout: () => void;
  onModeToggle: () => void;
  onShowThemeSubview: () => void;
  onViewChange: (view: AppView) => void;
}

/**
 * The main content panel of the mobile bottom sheet: nav items, theme
 * trigger row, and logout. Rendered inside the shell's slide track.
 *
 * `panelReference` and `themeButtonReference` are owned and passed down by
 * `MobileBottomSheet` so `useMenuNavigation` and focus-return on submenu
 * close operate against the correct DOM nodes.
 */
export default function BottomSheetMainPanel({
  user,
  view,
  baseTheme,
  mode,
  showThemeSubview,
  panelReference,
  themeButtonReference,
  onClose,
  onLogout,
  onModeToggle,
  onShowThemeSubview,
  onViewChange,
}: BottomSheetMainPanelProps) {
  const currentThemeLabel = THEMES.find(
    (theme) => theme.id === baseTheme,
  )?.label;

  return (
    <div
      style={{ width: '50%' }}
      role="menu"
      aria-label="User menu"
      tabIndex={-1}
      ref={panelReference}
      className="pb-4"
      inert={showThemeSubview ? true : undefined}
    >
      <MenuSection label="Logged in as" className="px-4 pt-2">
        <p className="mt-0.5 text-[var(--orbit-text)] text-xs tracking-tight font-medium truncate">
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
          className={`flex items-center gap-2 w-full pl-2.5 pr-3 py-2 text-[var(--orbit-text)] text-left cursor-pointer ${FOCUS_RING}`}
          onMouseEnter={(event) => event.currentTarget.focus()}
          onMouseDown={(event) => event.preventDefault()}
          onClick={onShowThemeSubview}
        >
          <i
            className="fa-solid fa-palette text-[var(--orbit-alt-text)] text-[0.75rem]"
            aria-hidden="true"
          />
          <div className="flex-1">
            <div>Theme</div>
            <div className="mt-0.5 text-[var(--orbit-alt-text)] line-clamp-1">
              {currentThemeLabel}
            </div>
          </div>
          <i
            className="fa-solid fa-chevron-right text-[var(--orbit-alt-text)] text-[0.6rem]"
            aria-hidden="true"
          />
        </button>
      </MenuSection>

      <MenuItem
        icon="fa-right-from-bracket"
        label="Log out"
        className="mt-2"
        onClick={() => {
          onLogout();
          onClose();
        }}
      />
    </div>
  );
}
