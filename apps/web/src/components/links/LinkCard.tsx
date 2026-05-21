import type { Link } from '../../lib/api';
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
  /** Called when the user clicks the card (to open + read) or the "Mark as unread" button. */
  onReadToggle: (link: Link) => void;
}

/**
 * Displays a single saved link as an interactive card.
 *
 * The card surface is a native `<a target="_blank">` so middle-click,
 * Cmd-click, Enter/Space, and the "Open in new tab" context menu all behave
 * as users expect. Activating the anchor on an unread link also marks it as
 * read; read links show a "Mark as unread" button that sits above the
 * anchor (sibling at higher z-index, no propagation needed).
 *
 * Delegates rendering to `LinkCardLayout` so that the interaction logic
 * (read toggling) is separated from the visual structure.
 */
export default function LinkCard({
  link,
  animationDelay = 0,
  isSelected = false,
  onReadToggle,
}: LinkCardProps) {
  function handleCardActivate() {
    // Native anchor opens the URL; we just record the read transition.
    if (!link.readAt) {
      onReadToggle(link);
    }
  }

  function handleUnreadClick() {
    onReadToggle(link);
  }

  return (
    <LinkCardLayout
      link={link}
      animationDelay={animationDelay}
      isSelected={isSelected}
      onCardActivate={handleCardActivate}
      onUnreadClick={handleUnreadClick}
    />
  );
}
