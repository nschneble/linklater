import Toast from './Toast';

interface PendingNoticeAnnouncerProps {
  notice: string | null;
  variant: 'success' | 'warning' | 'error';
  onDismiss: () => void;
  /**
   * Whether the message is the page's own account of itself rather than a
   * report on something the user just did. Painted in the flow instead of
   * in a toast, for the two reasons `AlreadySignedInNotice` gives about
   * its own message: a fixed timer takes away the only explanation the
   * page has (WCAG 2.2.1 Timing Adjustable), and a card pinned to the
   * viewport bottom can sit over the input being typed into (WCAG 2.4.11
   * Focus Not Obscured).
   */
  standing?: boolean;
}

/**
 * Pairs a cross-route pending notice's visible surface with an sr-only
 * live mirror, in one primitive so neither can drift from the other.
 *
 * The mirror exists because cross-route navigation mounts a fresh tree,
 * and a live region already populated on first paint reads as part of the
 * page rather than as an announcement; staying mounted and empty gives
 * screen readers a transition to report. Its role and live politeness
 * track the variant so the announcement fires at the priority the variant
 * asks for. The mirror is the only announcer here: the toast is handed
 * `announce={false}` and the standing panel's text is hidden from the
 * accessibility tree, because a second region on one message at one
 * instant is read twice, which is worse than either channel alone. The
 * test id is here because a host page can hold a second region of this
 * shape.
 *
 * The standing panel takes its paint from `AlreadySignedInNotice`, whose
 * slot it shares: both are inert statements about why the page looks the
 * way it does, and a variant fill would read as a report on an action.
 */
export default function PendingNoticeAnnouncer({
  notice,
  variant,
  onDismiss,
  standing = false,
}: PendingNoticeAnnouncerProps) {
  const mirrorRole = variant === 'error' ? 'alert' : 'status';
  const mirrorAriaLive = variant === 'error' ? 'assertive' : 'polite';

  return (
    <>
      {notice && standing && (
        <div className="flex flex-col items-center w-full max-w-md mx-auto mb-4 p-4 bg-[var(--mount-bg)] border-shadow text-[var(--mount-text)] text-sm rounded-2xl select-none">
          <p aria-hidden="true">
            <i className="fa-solid fa-circle-info mr-1.5" aria-hidden="true" />
            {notice}
          </p>
        </div>
      )}
      {notice && !standing && (
        <Toast
          announce={false}
          message={notice}
          onDismiss={onDismiss}
          variant={variant}
        />
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
