import { MOCK_GLYPHS } from './mockGlyphs';

/**
 * The static saved-link card in the app mock (mount surface), mirroring the
 * real `LinkCardLayout`: a left accent stripe (border-l-4, mount-highlight) with
 * right-only rounding, a circular favicon badge overlapping that stripe, then a
 * horizontal row of a thumbnail placeholder panel beside the stacked title +
 * site name, and a description line below. Decorative only: the favicon is a
 * CSS-painted <span> and the thumbnail is a placeholder panel (no <img>), and
 * there are no focusable descendants. Paints every mount slot the real card
 * uses — the accent border (mount-highlight), the favicon badge
 * (mount-highlight-hover), the thumbnail (mount-highlight fill + mount-highlight-fg
 * label, mirroring the real placehold.co image), the title (mount-text), and the
 * site name + description (mount-alt-text). The visible copy is asemic Old Turkic
 * (see mockGlyphs) so the aria-hidden mock reads as decoration.
 */
interface MockLinkCardProps {
  muted?: boolean;
}

export default function MockLinkCard({ muted }: MockLinkCardProps) {
  return (
    <div
      className="relative overflow-visible m-4 pl-6 pr-3 py-3 bg-[var(--mount-bg)] border-l-4 border-[var(--mount-highlight)] border-shadow rounded-r-xl data-muted:grayscale data-muted:opacity-10"
      data-muted={muted || undefined}
    >
      <span className="absolute left-0 top-3 -translate-x-1/2 w-5 h-5 bg-[var(--mount-highlight-hover)] rounded-full" />

      <div className="flex flex-row items-center">
        <div className="flex shrink-0 items-center justify-center w-[120px] h-[63px] bg-[var(--mount-highlight)] rounded-md">
          <span className="text-[var(--mount-highlight-fg)] text-[0.6rem] font-medium">
            {MOCK_GLYPHS.linkDomain}
          </span>
        </div>

        <div className="flex flex-col items-start min-w-0 ml-3">
          <p className="text-[var(--mount-text)] text-[0.78rem] font-semibold line-clamp-1">
            {MOCK_GLYPHS.linkTitle}
          </p>
          <p className="w-full text-[var(--mount-alt-text)] text-[0.65rem] truncate">
            {MOCK_GLYPHS.linkDomain}
          </p>
        </div>
      </div>

      <p className="mt-2 text-[var(--mount-alt-text)] text-[0.65rem] line-clamp-2">
        {MOCK_GLYPHS.linkBody}
      </p>
    </div>
  );
}
