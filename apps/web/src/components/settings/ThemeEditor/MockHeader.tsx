import { MOCK_GLYPHS } from './mockGlyphs';

/**
 * The static top nav bar in the app mock. Rendering surface is orbit (matches
 * the real header). Decorative only: the logo, wordmark, tagline, and avatar
 * are plain <span>/<div> shapes — no <button>, no <a href>, no focusable
 * descendants. Paints every orbit slot, so the rest of the mock is free to
 * style its orbit surfaces however reads best. The visible copy is asemic Old
 * Turkic (see mockGlyphs) so the aria-hidden mock reads as decoration.
 */
export default function MockHeader() {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 bg-[var(--orbit-bg)] border-b border-[var(--orbit-border)]">
      <div className="flex items-center gap-2">
        <span className="flex items-center justify-center w-6 h-6 bg-[var(--orbit-highlight)] rounded-full">
          <i
            className="fa-solid fa-link text-[var(--orbit-highlight-fg)] text-[0.6rem]"
            aria-hidden="true"
          />
        </span>
        <span className="leading-tight">
          <span className="block text-[var(--orbit-text)] text-sm font-bold">
            {MOCK_GLYPHS.wordmark}
          </span>
          <span className="block text-[var(--orbit-alt-text)] text-[0.6rem]">
            {MOCK_GLYPHS.tagline}
          </span>
        </span>
      </div>
      <span className="flex items-center gap-1.5">
        <span className="flex items-center justify-center w-6 h-6 bg-[var(--orbit-highlight-hover)] rounded-full">
          <span className="text-[var(--orbit-highlight-fg)] text-[0.6rem] font-bold">
            {MOCK_GLYPHS.avatarInitial}
          </span>
        </span>
        <i
          className="fa-solid fa-chevron-down text-[var(--orbit-alt-text)] text-[0.6rem]"
          aria-hidden="true"
        />
      </span>
    </div>
  );
}
