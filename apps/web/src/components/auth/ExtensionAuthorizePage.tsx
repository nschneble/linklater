import IconButton from '../common/IconButton';
import PrimaryButton from '../common/PrimaryButton';
import { FOCUS_RING } from '../../lib/styles';
import { useAuth } from '../../auth/AuthContext';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';

type Status = 'idle' | 'authorizing';

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

  const codeChallenge = searchParameters.get('code_challenge') ?? '';
  const redirectUri = searchParameters.get('redirect_uri') ?? '';

  const handleAuthorize = () => {
    setStatus('authorizing');
    const parameters = new URLSearchParams({
      code_challenge: codeChallenge,
      redirect_uri: redirectUri,
    });
    window.location.href = `${import.meta.env.VITE_API_BASE_URL as string}/auth/extension/authorize?${parameters.toString()}`;
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen px-4 bg-gradient-to-b from-[var(--page-gradient-from)] to-[var(--page-gradient-to)]">
        <div className="w-full max-w-md mx-auto p-8 bg-[var(--mount-bg)] border-shadow text-center rounded-2xl">
          <h1 className="mb-2 text-[var(--mount-text)] text-2xl font-bold">
            Sign in to authorize
          </h1>
          <p className="mb-6 text-[var(--mount-alt-text)] text-sm">
            Sign in to your Linklater account to authorize the extension.
          </p>
          <a
            className={`inline-block px-4 py-2 bg-[var(--mount-highlight)] text-[var(--mount-highlight-fg)] text-sm font-semibold rounded-lg ${FOCUS_RING}`}
            href="/login"
          >
            Sign in
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen px-4 bg-gradient-to-b from-[var(--page-gradient-from)] to-[var(--page-gradient-to)]">
      <div className="w-full max-w-md mx-auto p-8 bg-[var(--mount-bg)] border-shadow text-center space-y-4 rounded-2xl">
        <h1 className="text-[var(--mount-text)] text-2xl font-bold">
          Authorize Linklater Extension?
        </h1>
        <p className="text-[var(--mount-alt-text)] text-sm">
          Signed in as{' '}
          <span className="text-[var(--mount-text)] font-medium">
            {user.email}
          </span>
        </p>
        <p className="text-[var(--mount-alt-text)] text-xs">
          The extension will be able to save and manage your links.
        </p>

        <div className="flex gap-3 justify-center">
          <PrimaryButton
            type="button"
            disabled={status === 'authorizing'}
            onClick={() => void handleAuthorize()}
          >
            {status === 'authorizing' ? 'Authorizing…' : 'Authorize'}
          </PrimaryButton>
          <IconButton
            variant="elevated"
            disabled={status === 'authorizing'}
            onClick={() => window.close()}
          >
            Cancel
          </IconButton>
        </div>
      </div>
    </div>
  );
}
