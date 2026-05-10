import type { Link } from '../lib/api';
import LinkCardLayout from './LinkCardLayout';

/**
 * Animated placeholder shown while the first page of links is loading.
 *
 * Renders a single card-shaped skeleton with a pulsing animation. The parent
 * (`LinksList`) renders this instead of `LinkCard` when `loadingLinks && page === 1`.
 */
export function LinkCardSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading link"
      className="relative overflow-visible pl-10 pr-8 py-4 bg-[var(--bg-surface)] border-l-4 border-[var(--accent)] rounded-r-xl"
    >
      <div className="absolute left-0 top-4 -translate-x-1/2 w-8 h-8 rounded-2xl bg-[var(--accent)]" />
      <div className="space-y-1 animate-pulse">
        <div className="flex flex-row items-center">
          <div className="w-[60px] sm:w-[120px] h-[32px] sm:h-[63px] rounded-md bg-[var(--bg-elevated)] shrink-0" />
          <div className="flex flex-col items-start min-w-0 ml-3 gap-1.5 w-full">
            <div className="w-3/4 h-3.5 bg-[var(--bg-elevated)] rounded" />
            <div className="w-24 h-3 bg-[var(--bg-elevated)] rounded" />
          </div>
        </div>
        <div className="h-8 mt-2 space-y-1">
          <div className="w-full h-3 bg-[var(--bg-elevated)] rounded" />
          <div className="w-2/3 h-3 bg-[var(--bg-elevated)] rounded" />
        </div>
      </div>
    </div>
  );
}

interface LinkCardProps {
  /** The link data to display. */
  link: Link;
  /**
   * Base animation delay in milliseconds for the card-enter animation.
   * Each child element within the card adds an additional 60ms offset so they
   * stagger in sequence. Capped at 240ms by `LinksList` to keep large lists snappy.
   *
   * @default 0
   */
  animationDelay?: number;
  /** When `true`, renders a keyboard-selection highlight. */
  isSelected?: boolean;
  /** Called when the user clicks the card (to open + archive) or the "Mark as unread" button. */
  onArchiveToggle: (link: Link) => void;
}

/**
 * Displays a single saved link as an interactive card.
 *
 * Clicking the card opens the link in a new tab and, if it is currently unread,
 * immediately archives it (the "read it" action). Archived links show a
 * "Mark as unread" button instead.
 *
 * Delegates rendering to `LinkCardLayout` so that the interaction logic
 * (click handling, archive toggling) is separated from the visual structure.
 */
export default function LinkCard({
  link,
  animationDelay = 0,
  isSelected = false,
  onArchiveToggle,
}: LinkCardProps) {
  function handleCardClick() {
    window.open(link.url, '_blank', 'noreferrer');
    // Only archive on open when the link is currently unread. Clicking an
    // already-archived card should just open it without changing its state.
    if (!link.archivedAt) {
      onArchiveToggle(link);
    }
  }

  function handleUnarchiveClick(event: React.MouseEvent) {
    // Prevent the click from bubbling up to the card, which would re-open the URL.
    event.stopPropagation();
    onArchiveToggle(link);
  }

  return (
    <LinkCardLayout
      link={link}
      animationDelay={animationDelay}
      isSelected={isSelected}
      onCardClick={handleCardClick}
      onUnarchiveClick={handleUnarchiveClick}
    />
  );
}
