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
 * Props that configure the page copy for each specific verification flow.
 * The logic is identical for email verification and email-change verification —
 * only the user-visible text and the success-time notice keys differ.
 */
interface TokenVerificationPageProps {
  /** Page heading shown in the error state. */
  title: string;
  /**
   * Polite sr-only status text announced while the API call is in flight.
   * The verifying state renders a centered spinning icon only — this text
   * lives in an sr-only live region so screen-reader users still hear the
   * per-flow context.
   */
  verifyingText: string;
  /**
   * Pending-notice key queued when the user is authenticated at success
   * time (destination /unread). Surfaced via the destination page's toast +
   * sr-only mirror.
   */
  signedInNotice: PendingNotice;
  /**
   * Pending-notice key queued when the user is NOT authenticated at
   * success time (destination /login). Surfaced via the destination page's
   * toast + sr-only mirror.
   */
  signedOutNotice: PendingNotice;
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
  signedInNotice,
  signedOutNotice,
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

  // Mirror `user` into a ref so the auth-state branch inside the
  // verifyFn().then() callback reads the LATEST value rather than the
  // render-time closure. Today's verify endpoints don't issue session
  // cookies (apps/api/src/auth/auth.controller.ts), so the closure is
  // safe by accident — this ref makes correctness independent of that
  // server behavior. If a future verify endpoint creates a session via
  // onSuccess (e.g. await refreshUser() flipping user from null → non-null),
  // the post-await read will see the new value and route correctly.
  const userReference = useRef(user);
  useEffect(() => {
    userReference.current = user;
  }, [user]);

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
        const isSignedIn = userReference.current !== null;
        const noticeKey = isSignedIn ? signedInNotice : signedOutNotice;
        const destination = isSignedIn ? '/unread' : '/login';
        setPendingNotice(noticeKey);
        navigate(destination, { replace: true });
      })
      .catch((error: unknown) => {
        setStatus('error');
        setErrorMessage(getErrorMessage(error, 'Verification failed.'));
      });
  }, [
    navigate,
    onSuccess,
    searchParameters,
    signedInNotice,
    signedOutNotice,
    verifyFn,
  ]);

  // Verifying state mirrors StumblePage: a single centered spinning icon with
  // an sr-only polite status, no card chrome. The full card flashed visibly
  // on success before the auto-redirect fired, which looked like
  // "page loaded and immediately bounced." A bare spinner reads as a single
  // in-flight operation that either resolves to the destination page or, on
  // failure, expands into the full error card below.
  if (status === 'verifying') {
    return (
      <main className="flex items-center justify-center min-h-screen bg-[var(--base-bg)] text-[var(--base-alt-text)] select-none">
        <p role="status" aria-live="polite" className="sr-only">
          {verifyingText}
        </p>
        <i
          className="fa-solid fa-arrows-rotate fa-spin text-4xl opacity-50"
          aria-hidden="true"
        />
      </main>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen px-4 bg-gradient-to-b from-[var(--page-gradient-from)] to-[var(--page-gradient-to)]">
      <div className="w-full max-w-md mx-auto p-8 bg-[var(--mount-bg)] border-shadow rounded-2xl text-center select-none">
        <h1 className="mb-4 text-[var(--mount-text)] text-2xl font-bold">
          {title}
        </h1>
        <Alert className="mb-2" icon="fa-triangle-exclamation" variant="error">
          {errorMessage}
        </Alert>
        <p className="mb-6 text-[var(--mount-alt-text)] text-sm">{helpText}</p>
        <LinkButton
          surface="mount"
          className="text-sm"
          onClick={() => navigate('/unread')}
        >
          Back to Linklater
        </LinkButton>
      </div>
    </div>
  );
}
