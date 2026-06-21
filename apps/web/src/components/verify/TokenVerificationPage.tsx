import { setPendingNotice, type PendingNotice } from '../../lib/pendingNotice';
import { useAuth } from '../../auth/AuthContext';
import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

/**
 * Props that configure the per-flow notice keys and verifying-state copy.
 * The logic is identical for email verification and email-change
 * verification – only the user-visible text and the notice keys differ.
 */
interface TokenVerificationPageProps {
  /**
   * Polite sr-only status text announced while the API call is in flight.
   * The verifying state renders a centered spinning icon only – this text
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
  /**
   * Pending-notice key queued when verification fails (missing token,
   * expired token, server rejection). Error-variant in the catalog so the
   * surfacing toast rides assertive + alert; copy carries the recovery hint
   * inline because the actual recovery path lives behind auth (WCAG 3.3.3).
   */
  invalidNotice: PendingNotice;
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
 * calls `verifyFn`, and unconditionally redirects (replace) to `/unread`
 * (signed-in success), `/login` (signed-out success), or `/login` (any
 * failure). The destination page consumes the queued notice via
 * `usePendingNotice` and surfaces it as a toast + sr-only mirror.
 *
 * The verifying state is a bare centered spinner with an sr-only polite
 * status – the page is purely transient and any card chrome would flash
 * visibly for sub-second windows before the redirect fires, which reads as
 * "page loaded and immediately bounced." Failures surface as error-variant
 * toasts on /login rather than a full error card.
 *
 * Used by `VerifyEmailPage` (for initial email verification) and
 * `VerifyEmailChangePage` (for email-change confirmation).
 */
export default function TokenVerificationPage({
  verifyingText,
  signedInNotice,
  signedOutNotice,
  invalidNotice,
  verifyFn,
  onSuccess,
}: TokenVerificationPageProps) {
  const [searchParameters] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const hasVerified = useRef(false);

  // Mirror `user` into a ref so the auth-state branch inside the
  // verifyFn().then() callback reads the LATEST value rather than the
  // render-time closure. Today's verify endpoints don't issue session
  // cookies (apps/api/src/auth/auth.controller.ts), so the closure is
  // safe by accident – this ref makes correctness independent of that
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
      setPendingNotice(invalidNotice);
      navigate('/login', { replace: true });
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
        void error;
        setPendingNotice(invalidNotice);
        navigate('/login', { replace: true });
      });
  }, [
    invalidNotice,
    navigate,
    onSuccess,
    searchParameters,
    signedInNotice,
    signedOutNotice,
    verifyFn,
  ]);

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
