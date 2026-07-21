import Toast from './Toast';

interface PendingNoticeAnnouncerProps {
  /**
   * The message to surface, or `null` when no notice is queued. When `null`
   * nothing is rendered.
   */
  notice: string | null;
  /**
   * Controls icon, ARIA live shape, AND bundle paint on the Toast.
   * `'success'` and `'warning'` both ride `role="status"` +
   * `aria-live="polite"`; `'error'` rides `role="alert"` +
   * `aria-live="assertive"`. Warning shares the polite channel with success
   * because the underlying user action was intentional; the warn paint + icon
   * glyph carry the side-effect signal redundantly.
   */
  variant: 'success' | 'warning' | 'error';
  /**
   * Called when the toast is dismissed (user click or auto-dismiss timer,
   * 5s for success, 6s for warning/error).
   */
  onDismiss: () => void;
}

/**
 * Surfaces a one-shot cross-route pending notice as a `<Toast>`.
 *
 * There used to be a separate pre-mounted sr-only mirror here, because the
 * old Toast rendered its message at first paint and NVDA/JAWS/VoiceOver can
 * skip a live region that appears already populated on mount. The Toast now
 * owns its own announcement: it renders a dedicated sr-only live region that
 * mounts empty and fills a couple of frames later, so the empty -> populated
 * transition fires reliably. That makes the external mirror redundant, and a
 * second live region only risked a double announcement, so it is gone.
 *
 * `notice` arrives via `usePendingNotice`, which reads the queued message in a
 * mount-effect (null -> non-null after mount). That mounts the Toast fresh,
 * and the Toast's own deferred fill handles the transition.
 *
 * Consumers: `LinksView` (links-page arrivals) and `AuthForm` (login
 * arrivals). Both surface notices via `usePendingNotice` /
 * `consumePendingNotice` against the shared sessionStorage key.
 */
export default function PendingNoticeAnnouncer({
  notice,
  variant,
  onDismiss,
}: PendingNoticeAnnouncerProps) {
  if (!notice) return null;

  return <Toast message={notice} onDismiss={onDismiss} variant={variant} />;
}
