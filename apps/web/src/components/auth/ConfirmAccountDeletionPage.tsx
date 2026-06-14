import Alert from '../common/Alert';
import LinkButton from '../common/LinkButton';
import { confirmAccountDeletion } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import { setPendingNotice } from '../../lib/pendingNotice';
import { useAuth } from '../../auth/AuthContext';
import { useDocumentTitle } from '../../lib/hooks/useDocumentTitle';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

type Status = 'verifying' | 'error';

const TITLES: Record<Status, string> = {
  verifying: 'Account deletion — Linklater',
  error: 'Deletion link error — Linklater',
};

/**
 * Handles the `/account/confirm-deletion?token=…` route. Reached by clicking
 * the confirmation link emailed to magic-link-only-no-MFA accounts that
 * requested deletion. The page mounts and POSTs the token to the API.
 *
 * On success: queues the `account-deleted` notice, logs out, and redirects
 * to `/login` — the AuthForm surfaces the confirmation via its existing
 * toast + sr-only mirror channel. WCAG 3.2.5 is satisfied via implicit
 * request (the user clicked the emailed link expecting completion); no
 * extra confirmation click is required because the actual checked
 * confirmation already happened in Settings DangerZone before the email
 * was sent.
 *
 * Reachable while logged out — the recipient may have signed out, switched
 * browsers, or never been signed in on this device. `logout()` is
 * idempotent (no harm if there was no session).
 *
 * On error: keeps the richer interstitial card with help text and a
 * recovery path back to home, so failure modes are not condensed into a
 * disappearing toast.
 */
export default function ConfirmAccountDeletionPage() {
  const [searchParameters] = useSearchParams();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [status, setStatus] = useState<Status>('verifying');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hasConfirmed = useRef(false);
  const backButtonReference = useRef<HTMLButtonElement>(null);

  useDocumentTitle(TITLES[status]);

  useEffect(() => {
    if (hasConfirmed.current) return;
    hasConfirmed.current = true;

    const token = searchParameters.get('token');
    if (!token) {
      setStatus('error');
      setErrorMessage('No confirmation token found in the link.');
      return;
    }

    confirmAccountDeletion(token)
      .then(() => {
        setPendingNotice('account-deleted');
        logout();
        // `/login` is the actual destination — `/auth` was not a registered
        // route, so it fell through to the catch-all redirect at
        // `routes/Unauthenticated.tsx` and added an extra history entry.
        navigate('/login', { replace: true });
      })
      .catch((error: unknown) => {
        setStatus('error');
        setErrorMessage(
          getErrorMessage(
            error,
            'This deletion link is invalid, expired, or has already been used.',
          ),
        );
      });
  }, [logout, navigate, searchParameters]);

  useEffect(() => {
    if (status === 'error') {
      backButtonReference.current?.focus();
    }
  }, [status]);

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="flex items-center justify-center min-h-screen px-4 bg-gradient-to-b from-[var(--page-gradient-from)] to-[var(--page-gradient-to)]"
    >
      <div className="w-full max-w-md mx-auto p-8 bg-[var(--mount-bg)] border-shadow rounded-2xl text-center select-none">
        {status === 'verifying' && (
          <>
            <h1 className="mb-4 text-[var(--mount-text)] text-2xl font-bold">
              Verifying deletion link
            </h1>
            <p
              role="status"
              aria-live="polite"
              className="text-[var(--mount-alt-text)] animate-pulse"
            >
              Verifying your deletion link…
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <h1 className="mb-4 text-[var(--mount-text)] text-2xl font-bold">
              This link can't be used
            </h1>
            <Alert
              className="mb-2"
              icon="fa-triangle-exclamation"
              variant="error"
            >
              {errorMessage}
            </Alert>
            <p className="mb-6 text-[var(--mount-alt-text)] text-sm">
              If you still want to delete your account, sign in and start the
              deletion flow again from Settings.
            </p>
            <LinkButton
              ref={backButtonReference}
              surface="mount"
              onClick={() => navigate('/', { replace: true })}
            >
              Back to home
            </LinkButton>
          </>
        )}
      </div>
    </main>
  );
}
