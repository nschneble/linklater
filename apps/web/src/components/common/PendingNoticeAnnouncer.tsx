import Toast from './Toast';

interface PendingNoticeAnnouncerProps {
  notice: string | null;
  variant: 'success' | 'warning' | 'error';
  onDismiss: () => void;
}

/**
 * Pairs a cross-route pending notice's toast with an sr-only live mirror,
 * in one primitive so neither can drift from the other.
 *
 * The mirror exists because cross-route navigation mounts a fresh tree,
 * and a live region already populated on first paint reads as part of the
 * page rather than as an announcement; staying mounted and empty gives
 * screen readers a transition to report. Its role and live politeness
 * track the variant because two regions carrying one message at
 * mismatched priorities race on the announcement queue, which is worse
 * than either channel alone. The test id is here because a host page can
 * hold a second region of this shape.
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
