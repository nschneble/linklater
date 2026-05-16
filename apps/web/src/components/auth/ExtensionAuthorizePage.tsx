import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getErrorMessage } from '../../lib/errors';
import { useAuth } from '../../auth/AuthContext';
import { FOCUS_RING } from '../../lib/styles';

type Status = 'idle' | 'authorizing' | 'error';

/**
 * Handles the `/extension/authorize` route for the browser extension OAuth flow.
 *
 * The extension opens this page (via `chrome.identity.launchWebAuthFlow` or
 * a new tab) with `?code_challenge=<PKCE>&redirect_uri=<extension-uri>`.
 *
 * If the user is authenticated, they see a confirmation prompt. On approval,
 * the page calls `GET /auth/extension/authorize`, which stores an auth code
 * and redirects back to the extension's callback URI with `?code=...`.
 *
 * If the user is not authenticated, a login form is shown instead.
 */
export default function ExtensionAuthorizePage() {
  const { user } = useAuth();
  const [searchParameters] = useSearchParams();
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const codeChallenge = searchParameters.get('code_challenge') ?? '';
  const redirectUri = searchParameters.get('redirect_uri') ?? '';

  const handleAuthorize = async () => {
    setStatus('authorizing');
    setErrorMessage(null);
    try {
      const parameters = new URLSearchParams({
        code_challenge: codeChallenge,
        redirect_uri: redirectUri,
      });
      window.location.href = `${import.meta.env.VITE_API_BASE_URL as string}/auth/extension/authorize?${parameters.toString()}`;
    } catch (error: unknown) {
      setStatus('error');
      setErrorMessage(getErrorMessage(error, 'Authorization failed.'));
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen px-4 bg-gradient-to-b from-[var(--text-muted)] via-[var(--text-muted)] to-[var(--text)]">
        <div className="w-full max-w-md mx-auto p-8 bg-[var(--bg-surface)] border-shadow rounded-2xl text-center">
          <h1 className="mb-2 text-[var(--text)] text-2xl font-bold">
            Sign in to authorize
          </h1>
          <p className="mb-6 text-[var(--text-muted)] text-sm">
            Sign in to your Linklater account to authorize the extension.
          </p>
          <a
            className={`inline-block px-4 py-2 bg-[var(--accent)] text-white text-sm font-semibold rounded-lg ${FOCUS_RING}`}
            href="/login"
          >
            Sign in
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen px-4 bg-gradient-to-b from-[var(--text-muted)] via-[var(--text-muted)] to-[var(--text)]">
      <div className="w-full max-w-md mx-auto p-8 bg-[var(--bg-surface)] border-shadow rounded-2xl text-center space-y-4">
        <h1 className="text-[var(--text)] text-2xl font-bold">
          Authorize Linklater Extension?
        </h1>
        <p className="text-[var(--text-muted)] text-sm">
          Signed in as{' '}
          <span className="text-[var(--text)] font-medium">{user.email}</span>
        </p>
        <p className="text-[var(--text-muted)] text-xs">
          The extension will be able to save and manage your links.
        </p>

        {status === 'error' && errorMessage && (
          <p className="text-rose-400 text-sm" role="alert">
            {errorMessage}
          </p>
        )}

        <div className="flex gap-3 justify-center">
          <button
            className={`px-4 py-2 bg-[var(--accent)] text-white text-sm font-semibold rounded-lg ${FOCUS_RING} disabled:opacity-50`}
            disabled={status === 'authorizing'}
            type="button"
            onClick={() => void handleAuthorize()}
          >
            {status === 'authorizing' ? 'Authorizing…' : 'Authorize'}
          </button>
          <button
            className={`px-4 py-2 bg-[var(--bg-elevated)] text-[var(--text-muted)] text-sm rounded-lg ${FOCUS_RING}`}
            disabled={status === 'authorizing'}
            type="button"
            onClick={() => window.close()}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
