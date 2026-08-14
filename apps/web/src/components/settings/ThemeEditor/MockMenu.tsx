import { MOCK_GLYPHS } from './mockGlyphs';
import type { ReactNode } from 'react';

interface MockMenuRowProps {
  /** The Font Awesome glyph classes for the row's leading icon (e.g. `fa-solid fa-bookmark`). */
  icon: string;
  /** Overrides the icon's default color/size classes (the active + hover rows tint differently). */
  iconClassName?: string;
  /** Overrides the row's default classes (the hover row fills its whole shell). */
  className?: string;
  children: ReactNode;
}

/**
 * One decorative menu row: the plain <li> shell shared by every simple menu item
 * (Your links, Settings, Switch mode, Craft theme, Log out). Purely
 * presentational: NO role, NO aria-current/selected, NO handlers, and the icon
 * stays aria-hidden, so the whole mock stays a single aria-hidden decoration.
 * The two state rows pass `className`/`iconClassName` to preview the active + the
 * hover paint statically.
 */
function MockMenuRow({
  icon,
  iconClassName = 'text-[var(--orbit-alt-text)] text-[0.65rem]',
  className = 'flex items-center gap-2 px-2.5 py-1.5 text-[var(--orbit-text)] text-[0.7rem]',
  children,
}: MockMenuRowProps) {
  return (
    <li className={className}>
      <i className={`${icon} ${iconClassName}`} aria-hidden="true" />
      {children}
    </li>
  );
}

/**
 * The static "open" user menu in the app mock (orbit surface), mirroring the
 * real `UserMenu`: a "Logged in as" header, a nav group (Your links, Settings,
 * Switch mode, Craft your theme), a Theme submenu row, then Log out, separated
 * by the same bottom-border section dividers the real menu uses. Decorative
 * only: plain <div>/<ul>/<li> for layout, NO role="menu"/"menuitem", no
 * aria-haspopup/aria-expanded, no focusable rows; the Theme row + chevron only
 * LOOK like an affordance. State slots are shown statically the way the real
 * menu paints them: one row (Settings) previews the active-view style (icon
 * tinted orbit-highlight, row bg normal), and one row (Switch mode) previews the
 * hover style (full orbit-highlight fill, orbit-highlight-hover border,
 * orbit-highlight-fg text). The visible copy is asemic Old Turkic (see
 * mockGlyphs) so the aria-hidden mock reads as decoration.
 */
export default function MockMenu() {
  return (
    <div className="w-56 bg-[var(--orbit-bg)] border-shadow rounded-lg">
      <div className="px-3 pt-2.5 pb-2 border-b border-[var(--orbit-border)]">
        <p className="text-[var(--orbit-alt-text)] text-[0.55rem] uppercase tracking-wide">
          {MOCK_GLYPHS.loggedInAs}
        </p>
        <p className="text-[var(--orbit-text)] text-[0.7rem] font-medium truncate">
          {MOCK_GLYPHS.accountEmail}
        </p>
      </div>

      <ul className="py-1 border-b border-[var(--orbit-border)]">
        <MockMenuRow icon="fa-solid fa-bookmark">
          {MOCK_GLYPHS.yourLinks}
        </MockMenuRow>
        <MockMenuRow icon="fa-solid fa-gear">
          {MOCK_GLYPHS.settings}
        </MockMenuRow>
        <MockMenuRow
          icon="fa-solid fa-moon"
          iconClassName="text-[var(--orbit-highlight-fg)]/80 text-[0.65rem]"
          className="flex items-center gap-2 px-2.5 py-1.5 bg-[var(--orbit-highlight)]/80 border-y border-[var(--orbit-highlight-hover)]/80 text-[var(--orbit-highlight-fg)] text-[0.7rem]"
        >
          {MOCK_GLYPHS.toggleMode}
        </MockMenuRow>
        <MockMenuRow icon="fa-solid fa-paintbrush">
          {MOCK_GLYPHS.editTheme}
        </MockMenuRow>
      </ul>

      <div className="py-1 border-b border-[var(--orbit-border)]">
        <div className="flex items-center gap-2 px-2.5 py-1.5 text-[var(--orbit-text)] text-[0.7rem]">
          <i
            className="fa-solid fa-palette text-[var(--orbit-alt-text)]"
            aria-hidden="true"
          />
          <span className="flex-1 leading-tight">
            <span className="block text-[var(--orbit-text)]">
              {MOCK_GLYPHS.themeLabel}
            </span>
            <span className="block text-[var(--orbit-alt-text)] text-[0.6rem]">
              {MOCK_GLYPHS.themeName}
            </span>
          </span>
          <i
            className="fa-solid fa-chevron-right text-[var(--orbit-alt-text)] text-[0.55rem]"
            aria-hidden="true"
          />
        </div>
      </div>

      <ul className="py-1">
        <MockMenuRow icon="fa-solid fa-right-from-bracket">
          {MOCK_GLYPHS.logOut}
        </MockMenuRow>
      </ul>
    </div>
  );
}
