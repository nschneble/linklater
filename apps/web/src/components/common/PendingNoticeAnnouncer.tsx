import Toast from './Toast';

interface PendingNoticeAnnouncerProps {
  /**
   * The message to surface, or `null` when no notice is queued. When `null`
   * the visible Toast is omitted, but the sr-only live region stays mounted
   * with empty text - see the rationale below.
   */
  notice: string | null;
  /**
   * Controls icon, ARIA live shape, AND bundle paint on both the visible
   * Toast and the sr-only mirror. `'success'` and `'warning'` both ride
   * `role="status"` + `aria-live="polite"`; `'error'` rides `role="alert"`
   * + `aria-live="assertive"`. The mirror MUST match the Toast - divergence
   * (e.g. polite mirror under an assertive Toast) is worse than either
   * channel alone, because the two regions race on the SR's announcement
   * queue with mismatched priorities. Warning shares the polite channel
   * with success because the underlying user action was intentional; the
   * warn paint + icon glyph carry the side-effect signal redundantly.
   */
  variant: 'success' | 'warning' | 'error';
  /**
   * Called when the toast is dismissed (user click or auto-dismiss timer -
   * 5s for success, 6s for warning/error).
   */
  onDismiss: () => void;
}

/**
 * Surfaces a one-shot cross-route pending notice as a `<Toast>` plus a
 * pre-mounted sr-only live mirror. The pairing is load-bearing
 * accessibility logic - keeping them in a single primitive locks them
 * together so a future contributor cannot drift one without the other
 * (e.g. ship the toast without the mirror, or change one variant's
 * ARIA shape).
 *
 * Why the mirror exists: cross-route navigation creates a freshly-mounted
 * component tree where NVDA/JAWS can skip the conditional Toast's
 * live-region announcement (the live region is treated as part of
 * page load when it appears already populated on first paint). Keeping
 * this mirror span in the DOM always and swapping its text via state
 * ensures the empty → populated transition fires reliably across all
 * major screen readers.
 *
 * The mirror's role/aria-live track the `variant` so the two channels
 * agree (success → polite/status, error → alert/assertive). They MUST
 * agree per a11y-lead: a polite mirror under an assertive Toast lets
 * the assertive announcement get pre-empted or queued out of order on
 * NVDA.
 *
 * `aria-atomic="true"` so the full message is re-announced as a single
 * unit rather than the diff of the swap. The mirror carries a fixed
 * `data-testid` because a host page can hold a second live region of the
 * same shape (`AuthForm`'s arrival-error channel), and attribute-only
 * queries cannot tell the two apart. Co-existing with other live
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
  variant,
  onDismiss,
}: PendingNoticeAnnouncerProps) {
  const mirrorRole = variant === 'error' ? 'alert' : 'status';
  const mirrorAriaLive = variant === 'error' ? 'assertive' : 'polite';

  return (
    <>
      {notice && (
        <Toast message={notice} onDismiss={onDismiss} variant={variant} />
      )}
      <span
        className="sr-only"
        role={mirrorRole}
        aria-live={mirrorAriaLive}
        aria-atomic="true"
        data-testid="pending-notice-announcement"
      >
        {notice ?? ''}
      </span>
    </>
  );
}
