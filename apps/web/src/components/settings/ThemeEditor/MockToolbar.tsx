import { MOCK_GLYPHS } from './mockGlyphs';

/**
 * The static page toolbar in the app mock (base surface), mirroring the real
 * `LinksToolbar` structure: the page title, then a row pairing the Unread /
 * Read tab pills (left) with the Stumble + Add link actions (right), then a
 * full-width search field below. Decorative only — the "search field" is a
 * styled <div> (never an <input>, and with no leading icon or shortcut glyph),
 * the actions and pills are <span>s with no handlers and no focusable
 * descendants. Renders BOTH a static selected pill (Unread) and an unselected
 * pill (Read) so both tab styles can be checked at once. The Add link span
 * mirrors the real base-surface `PrimaryButton` (base-highlight fill) and the
 * Stumble span mirrors the real base-surface elevated `IconButton` (mount-bg
 * lift). The visible copy is asemic Old Turkic (see mockGlyphs) so the
 * aria-hidden mock reads as decoration.
 */
export default function MockToolbar() {
  return (
    <div className="space-y-2.5 px-4 pt-3">
      <span className="block text-[var(--base-text)] text-base font-bold">
        {MOCK_GLYPHS.yourLinks}
      </span>

      <div className="flex items-center justify-between gap-2">
        <div className="flex w-fit gap-1 p-1 bg-[var(--base-input-bg)] border border-[var(--base-border)] rounded-full">
          <span className="flex items-center gap-1 px-3 py-1 bg-[var(--base-highlight)] text-[var(--base-highlight-fg)] text-[0.65rem] font-semibold rounded-full">
            <i
              className="fa-solid fa-circle-dot text-[0.4rem]"
              aria-hidden="true"
            />
            {MOCK_GLYPHS.unread}
          </span>
          <span className="px-3 py-1 text-[var(--base-alt-text)] text-[0.65rem] font-semibold rounded-full">
            {MOCK_GLYPHS.read}
          </span>
        </div>

        <div className="flex gap-2">
          <span className="inline-flex items-center gap-1.5 pl-2.5 pr-3 py-1.5 bg-[var(--mount-bg)] border-shadow text-[var(--mount-text)] text-[0.7rem] font-semibold rounded-full">
            <i
              className="fa-brands fa-stumbleupon text-[0.6rem]"
              aria-hidden="true"
            />
            {MOCK_GLYPHS.stumble}
          </span>
          <span className="inline-flex items-center gap-1.5 pl-2.5 pr-3 py-1.5 bg-[var(--base-highlight)] border-shadow text-[var(--base-highlight-fg)] text-[0.7rem] font-semibold rounded-full">
            <i className="fa-solid fa-plus text-[0.6rem]" aria-hidden="true" />
            {MOCK_GLYPHS.addLink}
          </span>
        </div>
      </div>

      <div className="flex items-center w-full px-3 py-2 bg-[var(--base-input-bg)] border border-[var(--base-border)] rounded-lg">
        <span className="flex-1 text-[var(--base-alt-text)] text-[0.7rem]">
          {MOCK_GLYPHS.searchPlaceholder}
        </span>
      </div>
    </div>
  );
}
