import LinkCardLayout from '../LinkCardLayout';
import type { Link } from '../../../lib/api';

export { default as LinkCardSkeleton } from './LinkCardSkeleton';

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
