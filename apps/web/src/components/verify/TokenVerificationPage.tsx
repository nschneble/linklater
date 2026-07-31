import { setPendingNotice, type PendingNotice } from '../../lib/pendingNotice';
import { useAuth } from '../../auth/AuthContext';
import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

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
  onVerify: (token: string) => Promise<void>;
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
 * calls `onVerify`, and unconditionally redirects (replace) to `/unread`
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
  onVerify,
  onSuccess,
}: TokenVerificationPageProps) {
  const [searchParameters] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const hasVerified = useRef(false);

  // ref-mirror user so the post-await read sees latest, not stale closure
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

    onVerify(token)
      .then(async () => {
        // refresh auth first so the destination sees a fresh profile
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
    onVerify,
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
