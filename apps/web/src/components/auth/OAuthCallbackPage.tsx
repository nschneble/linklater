import Alert from '../common/Alert';
import { getErrorMessage } from '../../lib/errors';
import { FOCUS_RING } from '../../lib/styles';
import { useAuth } from '../../auth/AuthContext';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

type Status = 'loading' | 'error';

/**
 * Handles the OAuth redirect back from the API after Google or Apple sign-in.
 *
 * The API redirects here with `#token=<jwt>` (URL fragment) after successfully
 * authenticating the user via the OAuth provider. The fragment is never sent
 * to the server or included in the Referer header, which prevents the JWT from
 * leaking into server access logs or browser history. This page extracts the
 * token from the hash, stores it, fetches the user profile, and navigates to
 * the app. On failure it shows an error state with a link back to the login form.
 */
export default function OAuthCallbackPage() {
  const { loginWithToken } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    const parameters = new URLSearchParams(hash);
    const accessToken = parameters.get('token');
    const refreshToken = parameters.get('refresh') ?? undefined;

    // Strip the credentials out of the URL bar before doing anything else.
    // The fragment never reaches the server, but it persists in the
    // browser's address bar and history until the user navigates away —
    // shoulder-surfing a stale tab would expose a usable JWT. replaceState
    // keeps the entry in history (so Back still works) without the secret.
    if (typeof window !== 'undefined' && window.location.hash) {
      try {
        window.history.replaceState(
          null,
          '',
          window.location.pathname + window.location.search,
        );
      } catch {
        // history.replaceState is unavailable in sandboxed contexts —
        // silently fall through to the auth flow.
      }
    }

    if (!accessToken) {
      setStatus('error');
      setErrorMessage('Invalid authentication response. Please try again.');
      return;
    }

    loginWithToken(accessToken, refreshToken)
      .then(() => navigate('/unread', { replace: true }))
      .catch((error: unknown) => {
        setStatus('error');
        setErrorMessage(getErrorMessage(error, 'Failed to complete sign in.'));
      });
  }, [loginWithToken, navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen px-4 bg-gradient-to-b from-[var(--text-muted)] via-[var(--text-muted)] to-[var(--text)]">
      <div className="w-full max-w-md mx-auto p-8 bg-[var(--bg-surface)] border-shadow rounded-2xl text-center select-none">
        <h1 className="mb-4 text-[var(--text)] text-2xl font-bold">
          Signing you in…
        </h1>

        {status === 'loading' && (
          <p
            role="status"
            aria-live="polite"
            className="text-[var(--text-muted)] animate-pulse"
          >
            Just a moment…
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
            <p className="mb-6 text-[var(--text-muted)] text-sm">
              Something went wrong during sign-in.
            </p>
            <button
              type="button"
              className={`text-[var(--accent)] underline text-sm rounded ${FOCUS_RING}`}
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
