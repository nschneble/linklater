import Alert from '../common/Alert';
import LinkButton from '../common/LinkButton';
import { confirmAccountDeletion } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import { setAuthNotice } from '../../auth/authNotice';
import { useAuth } from '../../auth/AuthContext';
import { useDocumentTitle } from '../../lib/hooks/useDocumentTitle';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

type Status = 'verifying' | 'success' | 'error';

const TITLES: Record<Status, string> = {
  verifying: 'Account deletion — Linklater',
  success: 'Account deleted — Linklater',
  error: 'Deletion link error — Linklater',
};

/**
 * Handles the `/account/confirm-deletion?token=…` route. Reached by clicking
 * the confirmation link emailed to magic-link-only-no-MFA accounts that
 * requested deletion. The page mounts, POSTs the token to the API, then
 * shows one of three states.
 *
 * Reachable while logged out — the recipient may have signed out, switched
 * browsers, or never been signed in on this device. Logout is called on
 * the Continue button click rather than on success-state mount so the call
 * is idempotent (no harm if there was no session) and the user controls
 * the transition (better for screen-reader announcement timing per WCAG
 * 2.2.1 / 2.4.13).
 */
export default function ConfirmAccountDeletionPage() {
  const [searchParameters] = useSearchParams();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [status, setStatus] = useState<Status>('verifying');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hasConfirmed = useRef(false);
  const continueButtonReference = useRef<HTMLButtonElement>(null);
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
      .then(() => setStatus('success'))
      .catch((error: unknown) => {
        setStatus('error');
        setErrorMessage(
          getErrorMessage(
            error,
            'This deletion link is invalid, expired, or has already been used.',
          ),
        );
      });
  }, [searchParameters]);

  useEffect(() => {
    if (status === 'success') {
      continueButtonReference.current?.focus();
    } else if (status === 'error') {
      backButtonReference.current?.focus();
    }
  }, [status]);

  const handleContinue = () => {
    setAuthNotice('account-deleted');
    logout();
    navigate('/auth', { replace: true });
  };

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="flex items-center justify-center min-h-screen px-4 bg-gradient-to-b from-[var(--page-gradient-from)] via-[var(--page-gradient-via)] to-[var(--page-gradient-to)]"
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

        {status === 'success' && (
          <>
            <h1 className="mb-4 text-[var(--mount-text)] text-2xl font-bold">
              Account deleted
            </h1>
            <Alert className="mb-4" icon="fa-circle-check" variant="success">
              Your account has been permanently deleted.
            </Alert>
            <LinkButton
              ref={continueButtonReference}
              surface="mount"
              onClick={handleContinue}
            >
              Continue to sign-in
            </LinkButton>
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
