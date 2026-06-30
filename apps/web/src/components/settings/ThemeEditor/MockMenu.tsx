import { MOCK_GLYPHS } from './mockGlyphs';

/**
 * The static "open" user menu in the app mock (orbit surface). Mirrors the real
 * UserMenu: a "Logged in as" header plus the real rows in order (Your links,
 * Settings, Switch to dark mode, Edit your theme, Log out). Decorative
 * only: plain <div>/<ul>/<li> for layout, NO role="menu"/"menuitem", no
 * aria-haspopup/aria-expanded, no focusable rows. One active row previews
 * orbit-highlight / highlight-fg; one row previews highlight-hover. The visible
 * copy is asemic Old Turkic (see mockGlyphs) so the aria-hidden mock reads as
 * decoration.
 */
export default function MockMenu() {
  return (
    <div className="w-48 bg-[var(--orbit-bg)] border border-[var(--orbit-border)] rounded-lg shadow-lg">
      <div className="px-3 pt-2.5 pb-2 border-b border-[var(--orbit-border)]">
        <p className="text-[var(--orbit-alt-text)] text-[0.55rem] uppercase tracking-wide">
          {MOCK_GLYPHS.loggedInAs}
        </p>
        <p className="text-[var(--orbit-text)] text-[0.7rem] font-medium truncate">
          {MOCK_GLYPHS.accountEmail}
        </p>
      </div>
      <ul className="p-1">
        <li className="flex items-center gap-2 px-2 py-1.5 text-[var(--orbit-text)] text-[0.7rem] rounded-md">
          <i
            className="fa-solid fa-bookmark text-[0.65rem]"
            aria-hidden="true"
          />
          {MOCK_GLYPHS.yourLinks}
        </li>
        <li className="flex items-center gap-2 px-2 py-1.5 bg-[var(--orbit-highlight-hover)] text-[var(--orbit-text)] text-[0.7rem] rounded-md">
          <i className="fa-solid fa-gear text-[0.65rem]" aria-hidden="true" />
          {MOCK_GLYPHS.settings}
        </li>
        <li className="flex items-center gap-2 px-2 py-1.5 text-[var(--orbit-text)] text-[0.7rem] rounded-md">
          <i className="fa-solid fa-moon text-[0.65rem]" aria-hidden="true" />
          {MOCK_GLYPHS.toggleMode}
        </li>
        <li className="flex items-center gap-2 px-2 py-1.5 bg-[var(--orbit-highlight)] text-[var(--orbit-highlight-fg)] text-[0.7rem] font-semibold rounded-md">
          <i
            className="fa-solid fa-paintbrush text-[0.65rem]"
            aria-hidden="true"
          />
          {MOCK_GLYPHS.editTheme}
        </li>
        <li className="flex items-center gap-2 px-2 py-1.5 text-[var(--orbit-text)] text-[0.7rem] rounded-md">
          <i
            className="fa-solid fa-right-from-bracket text-[0.65rem]"
            aria-hidden="true"
          />
          {MOCK_GLYPHS.logOut}
        </li>
      </ul>
    </div>
  );
}
