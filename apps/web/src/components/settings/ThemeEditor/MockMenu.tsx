import { MOCK_GLYPHS } from './mockGlyphs';

/**
 * The static "open" user menu in the app mock (orbit surface), mirroring the
 * real `UserMenu`: a "Logged in as" header, a nav group (Your links, Settings,
 * Switch mode, Craft your theme), a Theme submenu row, then Log out — separated
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
    <div className="w-56 bg-[var(--orbit-bg)] border border-[var(--orbit-border)] rounded-lg shadow-lg">
      <div className="px-3 pt-2.5 pb-2 border-b border-[var(--orbit-border)]">
        <p className="text-[var(--orbit-alt-text)] text-[0.55rem] uppercase tracking-wide">
          {MOCK_GLYPHS.loggedInAs}
        </p>
        <p className="text-[var(--orbit-text)] text-[0.7rem] font-medium truncate">
          {MOCK_GLYPHS.accountEmail}
        </p>
      </div>

      <ul className="py-1 border-b border-[var(--orbit-border)]">
        <li className="flex items-center gap-2 px-2.5 py-1.5 text-[var(--orbit-text)] text-[0.7rem]">
          <i
            className="fa-solid fa-bookmark text-[var(--orbit-alt-text)] text-[0.65rem]"
            aria-hidden="true"
          />
          {MOCK_GLYPHS.yourLinks}
        </li>
        <li className="flex items-center gap-2 px-2.5 py-1.5 text-[var(--orbit-text)] text-[0.7rem]">
          <i
            className="fa-solid fa-gear text-[var(--orbit-highlight)] text-[0.65rem]"
            aria-hidden="true"
          />
          {MOCK_GLYPHS.settings}
        </li>
        <li className="flex items-center gap-2 px-2.5 py-1.5 bg-[var(--orbit-highlight)]/80 border-y border-[var(--orbit-highlight-hover)]/80 text-[var(--orbit-highlight-fg)] text-[0.7rem]">
          <i
            className="fa-solid fa-moon text-[var(--orbit-highlight-fg)]/80 text-[0.65rem]"
            aria-hidden="true"
          />
          {MOCK_GLYPHS.toggleMode}
        </li>
        <li className="flex items-center gap-2 px-2.5 py-1.5 text-[var(--orbit-text)] text-[0.7rem]">
          <i
            className="fa-solid fa-paintbrush text-[var(--orbit-alt-text)] text-[0.65rem]"
            aria-hidden="true"
          />
          {MOCK_GLYPHS.editTheme}
        </li>
      </ul>

      <div className="py-1 border-b border-[var(--orbit-border)]">
        <div className="flex items-center gap-2 px-2.5 py-1.5 text-[var(--orbit-text)] text-[0.7rem]">
          <i
            className="fa-solid fa-palette text-[var(--orbit-alt-text)] text-[0.65rem]"
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
        <li className="flex items-center gap-2 px-2.5 py-1.5 text-[var(--orbit-text)] text-[0.7rem]">
          <i
            className="fa-solid fa-right-from-bracket text-[var(--orbit-alt-text)] text-[0.65rem]"
            aria-hidden="true"
          />
          {MOCK_GLYPHS.logOut}
        </li>
      </ul>
    </div>
  );
}
