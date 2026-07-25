import { useToastAnnouncement } from '../../lib/hooks/useToastAnnouncement';
import Toast from './Toast';

interface ToastAnnouncerProps {
  /**
   * The in-session toast message, or `null` when no toast is showing. When
   * `null` the visible Toast is omitted, but the sr-only live region stays
   * mounted with empty text so the empty -> populated transition a screen
   * reader announces still fires on the next message.
   */
  message: string | null;
  /**
   * Called when the toast is dismissed (user click or the 5s auto-dismiss
   * timer). Wired to the owning hook's dismiss (`useToast().dismiss` or the
   * view's own handler).
   */
  onDismiss: () => void;
  /**
   * `data-testid` for the always-mounted mirror region so each host can locate
   * its own channel (e.g. `toast-announcement`,
   * `bookmarklet-toast-announcement`).
   */
  testId: string;
}

/**
 * Surfaces an in-session toast message as a visual `<Toast>` plus a pre-mounted
 * sr-only live mirror. The pairing is load-bearing accessibility logic, so
 * keeping it in a single primitive locks the two together: a future contributor
 * cannot ship the toast without the mirror, or let one drift from the other.
 *
 * Why the mirror exists: the visual Toast is mounted only while `message` is
 * non-null, which lets NVDA/JAWS miss its first announcement (the live node is
 * not in the accessibility tree at the instant the region would fire). The
 * Toast therefore renders `announce={false}` (no `role`/`aria-live`), and this
 * always-mounted `role="status"` region does the announcing instead. The text
 * swap is driven by `useToastAnnouncement`, which mirrors `message` into the
 * region and empties it after the auto-clear window so a later reader never
 * reaches stale text; it also forces a genuine text-node change when the SAME
 * message fires twice, which a naive `setState(sameString)` mirror would drop.
 *
 * `aria-atomic="true"` so the full message is re-announced as one unit rather
 * than the diff of the swap. Consumers: `LinksView` ("Link saved!"),
 * `SettingsView` (OAuth-link results), and `BookmarkletSection`
 * ("Bookmarklet regenerated").
 */
export default function ToastAnnouncer({
  message,
  onDismiss,
  testId,
}: ToastAnnouncerProps) {
  const announcement = useToastAnnouncement(message);

  return (
    <>
      {message && (
        <Toast announce={false} message={message} onDismiss={onDismiss} />
      )}
      <span
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-testid={testId}
      >
        {announcement}
      </span>
    </>
  );
}
