import { confirmAccountDeletion } from '../../lib/api';
import { setPendingNotice } from '../../lib/pendingNotice';
import { useAuth } from '../../auth/AuthContext';
import { useDocumentTitle } from '../../lib/hooks/useDocumentTitle';
import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

/**
 * Handles the `/account/confirm-deletion?token=…` route. Reached by clicking
 * the confirmation link emailed to magic-link-only-no-MFA accounts that
 * requested deletion. The page mounts and POSTs the token to the API.
 *
 * On success: queues the `account-deleted` notice, logs out, and redirects
 * to `/login` – the AuthForm surfaces the confirmation via its existing
 * toast + sr-only mirror channel. WCAG 3.2.5 is satisfied via implicit
 * request (the user clicked the emailed link expecting completion); no
 * extra confirmation click is required because the actual checked
 * confirmation already happened in Settings DangerZone before the email
 * was sent.
 *
 * Reachable while logged out – the recipient may have signed out, switched
 * browsers, or never been signed in on this device. `logout()` is
 * idempotent (no harm if there was no session).
 *
 * On error: queues the `deletion-link-invalid` error-variant notice and
 * redirects to `/login`. The toast carries the short error copy ("This
 * deletion link is invalid or expired."); the recovery path (sign in →
 * Settings → re-trigger delete) lives on the page the user lands on, so
 * the toast copy stays short. Mirrors the redirect-on-error pattern shared
 * with `TokenVerificationPage`.
 */
export default function ConfirmAccountDeletionPage() {
  const [searchParameters] = useSearchParams();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const hasConfirmed = useRef(false);

  useDocumentTitle('Linklater – Account deletion');

  useEffect(() => {
    if (hasConfirmed.current) return;
    hasConfirmed.current = true;

    const token = searchParameters.get('token');
    if (!token) {
      setPendingNotice('deletion-link-invalid');
      navigate('/login', { replace: true });
      return;
    }

    confirmAccountDeletion(token)
      .then(() => {
        setPendingNotice('account-deleted');
        logout();
        // `/login` is the actual destination – `/auth` was not a registered
        // route, so it fell through to the catch-all redirect at
        // `routes/Unauthenticated.tsx` and added an extra history entry.
        navigate('/login', { replace: true });
      })
      .catch((error: unknown) => {
        void error;
        setPendingNotice('deletion-link-invalid');
        navigate('/login', { replace: true });
      });
  }, [logout, navigate, searchParameters]);

  // The page is purely transient: spinner while the API call is in flight,
  // then an unconditional redirect to /login (success or failure). The
  // verifying state mirrors StumblePage – a single centered spinning icon
  // with an sr-only polite status, no card chrome. Card chrome would flash
  // visibly for sub-second windows before the redirect fires, which looks
  // like "page loaded and immediately bounced."
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="flex items-center justify-center min-h-screen bg-[var(--base-bg)] text-[var(--base-alt-text)] select-none"
    >
      <p role="status" aria-live="polite" className="sr-only">
        Verifying your deletion link…
      </p>
      <i
        className="fa-solid fa-arrows-rotate fa-spin text-4xl opacity-50"
        aria-hidden="true"
      />
    </main>
  );
}
