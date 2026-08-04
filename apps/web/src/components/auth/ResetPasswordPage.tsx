import Alert from '../common/Alert';
import FormInput from '../common/FormInput';
import { getErrorMessage } from '../../lib/errors';
import LinkButton from '../common/LinkButton';
import MfaView from './MfaView';
import PrimaryButton from '../common/PrimaryButton';
import { resetPassword, verifyOtp } from '../../lib/api';
import { setPendingNotice } from '../../lib/pendingNotice';
import { useAuth } from '../../auth/AuthContext';
import { useDocumentTitle } from '../../lib/hooks/useDocumentTitle';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

type MfaChallenge = 'totp' | 'recovery';

/**
 * Handles the `/reset-password?token=...` route. Renders a form for the user
 * to choose a new password. Validates that both password fields match
 * client-side before calling `POST /auth/reset-password`.
 *
 * On success the server issues a session – the user lands signed in on
 * `/unread` without having to retype credentials. TOTP-enrolled accounts hit
 * the MFA challenge first (same surface as login/magic-link MFA). The
 * destination page surfaces a `password-reset-success` toast via the
 * pending-notice mirror.
 *
 * The submit-in-flight window swaps the form out for a bare centered spinner
 * (matching `TokenVerificationPage` / `VerifyLoginPage`) so the post-submit
 * moment reads as transient routing rather than a card flash before the
 * redirect.
 *
 * The token is read from the `?token=` query parameter and is only valid
 * for 1 hour after the forgot-password email is sent.
 *
 * This route is always accessible without authentication.
 */
export default function ResetPasswordPage() {
  useDocumentTitle('Linklater – Reset password');

  const [searchParameters] = useSearchParams();
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [isInMfa, setIsInMfa] = useState(false);
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [mfaChallenge, setMfaChallenge] = useState<MfaChallenge>('totp');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaError, setMfaError] = useState<string | null>(null);
  const mfaErrorReference = useRef<HTMLParagraphElement>(null);
  const mfaInputReference = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (mfaError) {
      mfaErrorReference.current?.focus();
    }
  }, [mfaError]);

  const handleSubmit = async (formEvent: FormEvent) => {
    formEvent.preventDefault();
    setError(null);

    const token = searchParameters.get('token');
    if (!token) {
      setError('No reset token found in the link.');
      return;
    }

    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const result = await resetPassword(token, password);
      if ('mfaToken' in result) {
        setMfaToken(result.mfaToken);
        setMfaChallenge(result.mfaMethod);
        setIsInMfa(true);
        setLoading(false);
        return;
      }
      // server issued the session; hydrate auth and route to the app
      await refreshUser();
      setPendingNotice('password-reset-success');
      navigate('/unread', { replace: true });
    } catch (caughtError: unknown) {
      setError(getErrorMessage(caughtError, 'Password reset failed.'));
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (formEvent: FormEvent) => {
    formEvent.preventDefault();
    if (!mfaToken) return;
    setMfaError(null);
    setMfaLoading(true);
    try {
      await verifyOtp(mfaToken, mfaCode, mfaChallenge);
      await refreshUser();
      setMfaCode('');
      setPendingNotice('password-reset-success');
      navigate('/unread', { replace: true });
    } catch (caughtError: unknown) {
      setMfaError(getErrorMessage(caughtError, 'Invalid code'));
      setMfaCode('');
    } finally {
      setMfaLoading(false);
    }
  };

  // "branding" pins the surface so no stale film/custom palette leaks in
  if (isInMfa) {
    return (
      <div
        data-theme="branding"
        className="flex items-center justify-center min-h-screen px-4 bg-gradient-to-b from-[var(--page-gradient-from)] to-[var(--page-gradient-to)]"
      >
        <MfaView
          error={mfaError}
          errorReference={mfaErrorReference}
          loading={mfaLoading}
          mfaChallenge={mfaChallenge}
          mfaCode={mfaCode}
          mfaInputReference={mfaInputReference}
          onMfaCodeChange={setMfaCode}
          onSubmit={handleVerifyOtp}
          onSwitchToRecovery={() => {
            setMfaChallenge('recovery');
            setMfaCode('');
            setMfaError(null);
          }}
          onSwitchToTotp={() => {
            setMfaChallenge('totp');
            setMfaCode('');
            setMfaError(null);
          }}
        />
      </div>
    );
  }

  if (loading) {
    return (
      <main
        data-theme="branding"
        className="flex items-center justify-center min-h-screen bg-[var(--base-bg)] text-[var(--base-alt-text)] select-none"
      >
        <p role="status" aria-live="polite" className="sr-only">
          Resetting your password…
        </p>
        <i
          className="fa-solid fa-arrows-rotate fa-spin text-4xl opacity-50"
          aria-hidden="true"
        />
      </main>
    );
  }

  return (
    <div
      data-theme="branding"
      className="flex items-center justify-center min-h-screen px-4 bg-gradient-to-b from-[var(--page-gradient-from)] to-[var(--page-gradient-to)]"
    >
      <div className="w-full max-w-md mx-auto p-8 bg-[var(--mount-bg)] border-shadow rounded-2xl select-none">
        <h1 className="mb-2 text-[var(--mount-text)] text-center text-2xl font-bold">
          Reset Password
        </h1>
        <p className="mb-6 text-[var(--mount-alt-text)] text-center text-sm">
          No one liked your old password, anyways.
        </p>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <label
            className="block mb-0 text-[var(--mount-alt-text)] text-sm font-medium"
            htmlFor="reset-password"
          >
            New password
          </label>
          <FormInput
            id="reset-password"
            type="password"
            surface="mount"
            autoComplete="new-password"
            onChange={(event) => setPassword(event.target.value)}
            value={password}
            required
            minLength={12}
          />

          <label
            className="block mb-0 text-[var(--mount-alt-text)] text-sm font-medium"
            htmlFor="reset-confirm"
          >
            Confirm new password
          </label>
          <FormInput
            id="reset-confirm"
            type="password"
            surface="mount"
            autoComplete="new-password"
            onChange={(event) => setConfirm(event.target.value)}
            value={confirm}
            required
          />

          {error && <Alert variant="error">{error}</Alert>}

          <PrimaryButton className="w-full py-2.5">
            <i className="fa-solid fa-lock text-xs" aria-hidden="true" />
            Reset password
          </PrimaryButton>

          <p className="text-center">
            <LinkButton onClick={() => navigate('/login')}>
              Back to login
            </LinkButton>
          </p>
        </form>
      </div>
    </div>
  );
}
