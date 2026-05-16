import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { verifyMagicLink } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import { useAuth } from '../../auth/AuthContext';

type Status = 'verifying' | 'success' | 'error';

/**
 * Handles the `/verify-login?token=…` route for magic-link login.
 *
 * Reads the `?token=` query parameter, calls `POST /auth/verify-magic-link`,
 * stores the returned JWT via `loginWithToken`, and navigates to `/unread`.
 */
export default function VerifyLoginPage() {
  const [searchParameters] = useSearchParams();
  const navigate = useNavigate();
  const { loginWithToken } = useAuth();
  const [status, setStatus] = useState<Status>('verifying');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hasVerified = useRef(false);

  useEffect(() => {
    if (hasVerified.current) return;
    hasVerified.current = true;

    const token = searchParameters.get('token');
    if (!token) {
      setStatus('error');
      setErrorMessage('No login token found in the link.');
      return;
    }

    verifyMagicLink(token)
      .then(async ({ accessToken }) => {
        await loginWithToken(accessToken);
        setStatus('success');
        navigate('/unread', { replace: true });
      })
      .catch((error: unknown) => {
        setStatus('error');
        setErrorMessage(getErrorMessage(error, 'Login failed.'));
      });
  }, [loginWithToken, navigate, searchParameters]);

  return (
    <div className="flex items-center justify-center min-h-screen px-4 bg-gradient-to-b from-[var(--text-muted)] via-[var(--text-muted)] to-[var(--text)]">
      <div className="w-full max-w-md mx-auto p-8 bg-[var(--bg-surface)] border-shadow rounded-2xl text-center select-none">
        <h1 className="mb-4 text-[var(--text)] text-2xl font-bold">
          Logging in…
        </h1>

        {status === 'verifying' && (
          <p className="text-[var(--text-muted)] animate-pulse">
            Verifying your login link…
          </p>
        )}

        {status === 'error' && (
          <>
            <p className="mb-2 text-rose-400 text-sm" role="alert">
              {errorMessage}
            </p>
            <p className="mb-6 text-[var(--text-muted)] text-sm">
              This login link may have expired or already been used. Request a
              new one from the login page.
            </p>
            <button
              type="button"
              className="text-[var(--accent)] underline text-sm"
              onClick={() => navigate('/login')}
            >
              Back to login
            </button>
          </>
        )}
      </div>
    </div>
  );
}
