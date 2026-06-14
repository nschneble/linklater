import { resetPassword } from '../../lib/api';
import { setPendingNotice } from '../../lib/pendingNotice';
import { getErrorMessage } from '../../lib/errors';
import { useDocumentTitle } from '../../lib/hooks/useDocumentTitle';
import Alert from '../common/Alert';
import FormInput from '../common/FormInput';
import LinkButton from '../common/LinkButton';
import PrimaryButton from '../common/PrimaryButton';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

// Brief pre-navigation announcement window. Lets the sr-only status
// region populate and start its polite utterance before we route to
// /login; otherwise the route change can race the announcement and
// drop it on some SR/browser combos (per a11y-lead). The visible Toast
// on /login is the reinforcement, not the sole channel.
const RESET_SUCCESS_REDIRECT_DELAY_MS = 800;

/**
 * Handles the `/reset-password?token=...` route. Renders a form for the user
 * to choose a new password. Validates that both password fields match
 * client-side before calling `POST /auth/reset-password`.
 *
 * On success, queues a `password-reset-success` pending notice and redirects
 * to /login after a brief sr-only announcement window — the destination
 * surfaces the notice as a Toast + sr-only mirror, so a screen reader gets
 * the confirmation from both the source page (sr-only status) and the
 * destination (mirror), never silently in between.
 *
 * The token is read from the `?token=` query parameter and is only valid
 * for 1 hour after the forgot-password email is sent.
 *
 * This route is always accessible without authentication.
 */
export default function ResetPasswordPage() {
  useDocumentTitle('Reset password — Linklater');

  const [searchParameters] = useSearchParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (redirectTimer.current !== null) {
        clearTimeout(redirectTimer.current);
      }
    };
  }, []);

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
      await resetPassword(token, password);
      setSuccess(true);
      setPendingNotice('password-reset-success');
      redirectTimer.current = setTimeout(() => {
        navigate('/login', { replace: true });
      }, RESET_SUCCESS_REDIRECT_DELAY_MS);
    } catch (caughtError: unknown) {
      setError(getErrorMessage(caughtError, 'Password reset failed.'));
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen px-4 bg-gradient-to-b from-[var(--page-gradient-from)] to-[var(--page-gradient-to)]">
      <div className="w-full max-w-md mx-auto p-8 bg-[var(--mount-bg)] border-shadow rounded-2xl select-none">
        <h1 className="mb-2 text-[var(--mount-text)] text-center text-2xl font-bold">
          Reset Password
        </h1>
        <p className="mb-6 text-[var(--mount-alt-text)] text-center text-sm">
          No one liked your old password, anyways.
        </p>

        {success ? (
          // Minimal sr-only-driven confirmation window before the redirect
          // fires. Avoids a flashy card flip (bouncing checkmark, "I'd like
          // to log in now" button) and lets the polite status start its
          // utterance before the route change — the destination /login
          // page's pending-notice mirror picks up where this one leaves off.
          <p
            role="status"
            aria-live="polite"
            className="text-[var(--mount-alt-text)] text-center text-sm"
          >
            Password updated. Signing you in…
          </p>
        ) : (
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

            <PrimaryButton disabled={loading} className="w-full py-2.5">
              <i className="fa-solid fa-lock text-xs" aria-hidden="true" />
              Reset password
            </PrimaryButton>

            <p className="text-center">
              <LinkButton onClick={() => navigate('/login')}>
                Back to login
              </LinkButton>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
