import Toast from './Toast';

interface PendingNoticeAnnouncerProps {
  /**
   * The message to surface, or `null` when no notice is queued. When `null`
   * the visible Toast is omitted, but the sr-only live region stays mounted
   * with empty text — see the rationale below.
   */
  notice: string | null;
  /**
   * Called when the toast is dismissed (user click or 3s auto-dismiss).
   */
  onDismiss: () => void;
}

/**
 * Surfaces a one-shot cross-route pending notice as a `<Toast>` plus a
 * pre-mounted sr-only `aria-live="polite"` mirror. The pairing is
 * load-bearing accessibility logic — keeping them in a single primitive
 * locks them together so a future contributor cannot drift one without the
 * other (e.g. ship the toast without the mirror, or change one variant's
 * ARIA shape).
 *
 * Why the mirror exists: cross-route navigation creates a freshly-mounted
 * component tree where NVDA/JAWS can skip the conditional Toast's
 * `role="status"` announcement (the live region is treated as part of
 * page load when it appears already populated on first paint). Keeping
 * this mirror span in the DOM always and swapping its text via state
 * ensures the empty → populated transition fires reliably across all
 * major screen readers.
 *
 * `aria-atomic="true"` so the full message is re-announced as a single
 * unit rather than the diff of the swap. Co-existing with other polite
 * regions on the same page is fine: this mirror fires at most once per
 * route mount (`consumePendingNotice` clears sessionStorage), so practical
 * collision is near-zero.
 *
 * Consumers: `LinksView` (links-page arrivals) and `AuthForm` (login
 * arrivals). Both surface notices via `usePendingNotice` /
 * `consumePendingNotice` against the shared sessionStorage key.
 */
export default function PendingNoticeAnnouncer({
  notice,
  onDismiss,
}: PendingNoticeAnnouncerProps) {
  return (
    <>
      {notice && (
        <Toast message={notice} onDismiss={onDismiss} variant="success" />
      )}
      <span
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {notice ?? ''}
      </span>
    </>
  );
}
