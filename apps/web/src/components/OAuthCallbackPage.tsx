import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getErrorMessage } from '../lib/errors';
import { useAuth } from '../auth/AuthContext';

type Status = 'loading' | 'error';

/**
 * Handles the OAuth redirect back from the API after Google or Apple sign-in.
 *
 * The API redirects here with `?token=<jwt>` after successfully authenticating
 * the user via the OAuth provider. This page stores the JWT, fetches the user
 * profile, and navigates to the app. On failure it shows an error state with
 * a link back to the login form.
 */
export default function OAuthCallbackPage() {
  const { loginWithToken } = useAuth();
  const navigate = useNavigate();
  const [searchParameters] = useSearchParams();
  const [status, setStatus] = useState<Status>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParameters.get('token');

    if (!token) {
      setStatus('error');
      setErrorMessage('Invalid authentication response. Please try again.');
      return;
    }

    loginWithToken(token)
      .then(() => navigate('/unread', { replace: true }))
      .catch((error: unknown) => {
        setStatus('error');
        setErrorMessage(getErrorMessage(error, 'Failed to complete sign in.'));
      });
  }, [searchParameters, loginWithToken, navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen px-4 bg-gradient-to-b from-[var(--text-muted)] via-[var(--text-muted)] to-[var(--text)]">
      <div className="w-full max-w-md mx-auto p-8 bg-[var(--bg-surface)] border-shadow rounded-2xl text-center select-none">
        <h1 className="mb-4 text-[var(--text)] text-2xl font-bold">
          Signing you in…
        </h1>

        {status === 'loading' && (
          <p className="text-[var(--text-muted)] animate-pulse">
            Just a moment…
          </p>
        )}

        {status === 'error' && (
          <>
            <p className="mb-2 text-rose-400 text-sm" role="alert">
              {errorMessage}
            </p>
            <p className="mb-6 text-[var(--text-muted)] text-sm">
              Something went wrong during sign-in.
            </p>
            <button
              type="button"
              className="text-[var(--accent)] underline text-sm"
              onClick={() => navigate('/')}
            >
              Back to login
            </button>
          </>
        )}
      </div>
    </div>
  );
}
