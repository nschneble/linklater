import { MOCK_GLYPHS } from './mockGlyphs';

/**
 * The static saved-link card in the app mock (mount surface). Decorative only:
 * the favicon is a CSS-painted <span> dot and the preview is a placeholder
 * panel (no <img>), and there are no focusable descendants. Paints every mount
 * slot the real card uses — the left accent border (mount-highlight), the
 * favicon dot (mount-highlight-hover), and the placeholder preview, which
 * mirrors the real app's placehold.co fill+label (mount-highlight background
 * with mount-highlight-fg text). The visible copy is asemic Old Turkic (see
 * mockGlyphs) so the aria-hidden mock reads as decoration.
 */
export default function MockLinkCard() {
  return (
    <div className="p-3 bg-[var(--mount-bg)] border border-l-4 border-[var(--mount-border)] border-l-[var(--mount-highlight)] rounded-xl">
      <div className="flex items-start gap-2.5">
        <span className="flex shrink-0 w-5 h-5 bg-[var(--mount-highlight-hover)] rounded-full" />
        <div className="flex-1 min-w-0">
          <p className="text-[var(--mount-text)] text-[0.78rem] font-semibold truncate">
            {MOCK_GLYPHS.linkTitle}
          </p>
          <p className="text-[var(--mount-alt-text)] text-[0.65rem] truncate">
            {MOCK_GLYPHS.linkDomain}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center w-full h-14 mt-2.5 bg-[var(--mount-highlight)] rounded-lg">
        <span className="text-[var(--mount-highlight-fg)] text-[0.6rem] font-medium">
          {MOCK_GLYPHS.linkDomain}
        </span>
      </div>

      <p className="mt-2 text-[var(--mount-alt-text)] text-[0.65rem] line-clamp-2">
        {MOCK_GLYPHS.linkBody}
      </p>
    </div>
  );
}
