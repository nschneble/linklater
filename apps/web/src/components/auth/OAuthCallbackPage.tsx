import { setPendingNotice } from '../../lib/pendingNotice';
import { useAuth } from '../../auth/AuthContext';
import { useDocumentTitle } from '../../lib/hooks/useDocumentTitle';
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';

/**
 * Handles the OAuth redirect back from the API after Google or Apple sign-in.
 *
 * The API redirects here with `#token=<jwt>` (URL fragment) after successfully
 * authenticating the user via the OAuth provider. The fragment is never sent
 * to the server or included in the Referer header, which prevents the JWT from
 * leaking into server access logs or browser history. This page extracts the
 * token from the hash, stores it, fetches the user profile, and navigates to
 * the app.
 *
 * On failure (missing token or `loginWithToken` rejection) the page queues the
 * `oauth-failed` error-variant notice and redirects to `/login`. AuthForm
 * surfaces the toast (role="alert" + aria-live="assertive") + sr-only mirror.
 * Mirrors the redirect-on-error pattern shared with `TokenVerificationPage`,
 * `VerifyLoginPage`, and `ConfirmAccountDeletionPage` – the provider's specific
 * error message is intentionally dropped because the recovery path is identical
 * regardless of the underlying OAuth failure (retry sign-in on /login), and the
 * 6s toast window is too short for SRs to parse a free-form provider message.
 */
export default function OAuthCallbackPage() {
  useDocumentTitle('Linklater – Sign in');
  const { loginWithToken } = useAuth();
  const navigate = useNavigate();
  const hasHandled = useRef(false);

  useEffect(() => {
    if (hasHandled.current) return;
    hasHandled.current = true;

    const hash = window.location.hash.slice(1);
    const parameters = new URLSearchParams(hash);
    const accessToken = parameters.get('token');
    const refreshToken = parameters.get('refresh') ?? undefined;

    // Strip the credentials out of the URL bar before doing anything else.
    // The fragment never reaches the server, but it persists in the
    // browser's address bar and history until the user navigates away –
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
        // history.replaceState is unavailable in sandboxed contexts –
        // silently fall through to the auth flow.
      }
    }

    if (!accessToken) {
      setPendingNotice('oauth-failed');
      navigate('/login', { replace: true });
      return;
    }

    loginWithToken(accessToken, refreshToken)
      .then(() => navigate('/unread', { replace: true }))
      .catch((error: unknown) => {
        void error;
        setPendingNotice('oauth-failed');
        navigate('/login', { replace: true });
      });
  }, [loginWithToken, navigate]);

  // The page is purely transient: spinner while loginWithToken is in flight,
  // then an unconditional redirect (success → /unread, failure → /login).
  // The verifying state mirrors VerifyLoginPage / ConfirmAccountDeletionPage –
  // a single centered spinning icon with an sr-only polite status, no card
  // chrome. Card chrome would flash visibly for sub-second windows before the
  // redirect fires, which reads as "page loaded and immediately bounced."
  return (
    <main className="flex items-center justify-center min-h-screen bg-[var(--base-bg)] text-[var(--base-alt-text)] select-none">
      <p role="status" aria-live="polite" className="sr-only">
        Signing you in…
      </p>
      <i
        className="fa-solid fa-arrows-rotate fa-spin text-4xl opacity-50"
        aria-hidden="true"
      />
    </main>
  );
}
