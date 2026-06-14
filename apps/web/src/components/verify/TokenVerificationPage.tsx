import Alert from '../common/Alert';
import LinkButton from '../common/LinkButton';
import { getErrorMessage } from '../../lib/errors';
import { setPendingNotice, type PendingNotice } from '../../lib/pendingNotice';
import { useAuth } from '../../auth/AuthContext';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

/**
 * The two persistent states of a token verification flow. On success we no
 * longer render a card — we queue a pending notice and immediately redirect
 * to the destination page, which surfaces the message via toast + sr-only
 * mirror. Mirrors the auto-redirect pattern in ConfirmAccountDeletionPage.
 */
type Status = 'verifying' | 'error';

/**
 * Catalog keys for the post-redirect toast. The auth-state branch is decided
 * at success time: signed-in users land on /unread; signed-out users land on
 * /login. The destination's `usePendingNotice` hook consumes the keyed
 * message and surfaces it via the shared toast + sr-only mirror channel.
 */
interface SuccessNotices {
  signedIn: PendingNotice;
  signedOut: PendingNotice;
}

/**
 * Props that configure the page copy for each specific verification flow.
 * The logic is identical for email verification and email-change verification —
 * only the user-visible text and the success-time notice catalog keys differ.
 */
interface TokenVerificationPageProps {
  /** Page heading shown during verifying + error states. */
  title: string;
  /** Text shown while the API call is in flight. */
  verifyingText: string;
  /**
   * Two `PendingNotice` keys: the `signedIn` key is queued when the user is
   * authenticated at success time (destination /unread); the `signedOut` key
   * is queued otherwise (destination /login). Both messages get surfaced via
   * the destination page's toast + sr-only mirror.
   */
  successNotices: SuccessNotices;
  /** Text shown below the error message to guide the user. */
  helpText: string;
  /**
   * The verification API function to call. Receives the token from the
   * `?token=` query parameter. Should resolve on success and reject with
   * an error on failure.
   */
  verifyFn: (token: string) => Promise<void>;
  /**
   * Called immediately after a successful verification, before the user
   * navigates away. Use to refresh stale auth state (e.g. re-fetch the
   * user profile so email changes/verifications are reflected on return).
   * Awaited so the destination page sees the freshest auth state.
   */
  onSuccess?: () => void | Promise<void>;
}

/**
 * Generic full-page token verification UI. Reads `?token=` from the URL,
 * calls `verifyFn`, and renders one of two persistent states: verifying or
 * error.
 *
 * On success the page does NOT render a confirmation card — instead it
 * queues a pending notice keyed by current auth state and immediately
 * redirects (replace) to either `/unread` (signed-in) or `/login`
 * (signed-out). The destination page consumes the notice via
 * `usePendingNotice` and surfaces it as a toast + sr-only mirror. Mirrors
 * the auto-redirect pattern shipped in Wave 2 (`ConfirmAccountDeletionPage`).
 *
 * Used by `VerifyEmailPage` (for initial email verification) and
 * `VerifyEmailChangePage` (for email-change confirmation).
 */
export default function TokenVerificationPage({
  title,
  verifyingText,
  successNotices,
  helpText,
  verifyFn,
  onSuccess,
}: TokenVerificationPageProps) {
  const [searchParameters] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [status, setStatus] = useState<Status>('verifying');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hasVerified = useRef(false);

  useEffect(() => {
    if (hasVerified.current) return;
    hasVerified.current = true;

    const token = searchParameters.get('token');
    if (!token) {
      setStatus('error');
      setErrorMessage('No verification token found in the link.');
      return;
    }

    verifyFn(token)
      .then(async () => {
        // Refresh auth state BEFORE queuing the notice + navigating so the
        // destination page renders against the latest user profile (e.g.
        // post-verification `emailVerifiedAt` timestamp or updated email).
        await onSuccess?.();
        const isSignedIn = user !== null;
        const noticeKey = isSignedIn
          ? successNotices.signedIn
          : successNotices.signedOut;
        const destination = isSignedIn ? '/unread' : '/login';
        setPendingNotice(noticeKey);
        navigate(destination, { replace: true });
      })
      .catch((error: unknown) => {
        setStatus('error');
        setErrorMessage(getErrorMessage(error, 'Verification failed.'));
      });
  }, [navigate, onSuccess, searchParameters, successNotices, user, verifyFn]);

  return (
    <div className="flex items-center justify-center min-h-screen px-4 bg-gradient-to-b from-[var(--page-gradient-from)] to-[var(--page-gradient-to)]">
      <div className="w-full max-w-md mx-auto p-8 bg-[var(--mount-bg)] border-shadow rounded-2xl text-center select-none">
        <h1 className="mb-4 text-[var(--mount-text)] text-2xl font-bold">
          {title}
        </h1>

        {status === 'verifying' && (
          <p
            role="status"
            aria-live="polite"
            className="text-[var(--mount-alt-text)] animate-pulse"
          >
            {verifyingText}
          </p>
        )}

        {status === 'error' && (
          <>
            <Alert
              className="mb-2"
              icon="fa-triangle-exclamation"
              variant="error"
            >
              {errorMessage}
            </Alert>
            <p className="mb-6 text-[var(--mount-alt-text)] text-sm">
              {helpText}
            </p>
            <LinkButton
              surface="mount"
              className="text-sm"
              onClick={() => navigate('/unread')}
            >
              Back to Linklater
            </LinkButton>
          </>
        )}
      </div>
    </div>
  );
}
