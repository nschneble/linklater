import { resetPassword } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import { useDocumentTitle } from '../../lib/hooks/useDocumentTitle';
import Alert from '../common/Alert';
import FormInput from '../common/FormInput';
import LinkButton from '../common/LinkButton';
import PrimaryButton from '../common/PrimaryButton';
import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

/**
 * Handles the `/reset-password?token=...` route. Renders a form for the user
 * to choose a new password. Validates that both password fields match
 * client-side before calling `POST /auth/reset-password`.
 *
 * On success, switches to a confirmation view with a link back to the login
 * screen. The token is read from the `?token=` query parameter and is only
 * valid for 1 hour after the forgot-password email is sent.
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
    } catch (caughtError: unknown) {
      setError(getErrorMessage(caughtError, 'Password reset failed.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen px-4 bg-gradient-to-b from-[var(--text-muted)] via-[var(--text-muted)] to-[var(--text)]">
      <div className="w-full max-w-md mx-auto p-8 bg-[var(--bg-surface)] border-shadow rounded-2xl select-none">
        {success && (
          <i
            className="block mb-4 fa-solid fa-circle-check text-4xl text-[var(--text-subtle)] animate-bounce text-center"
            aria-hidden="true"
          />
        )}
        <h1 className="mb-2 text-[var(--text)] text-center text-2xl font-bold">
          {success ? (
            <>
              Your Password Has Been{' '}
              <span className="underline underline-offset-3 decoration-[var(--accent)]">
                Reset
              </span>
            </>
          ) : (
            'Reset Password'
          )}
        </h1>
        <p className="mb-6 text-[var(--text-muted)] text-center text-sm">
          {success
            ? "I'm so proud of you."
            : 'No one liked your old password, anyways.'}
        </p>

        {success ? (
          <div className="text-center space-y-4">
            <PrimaryButton
              className="w-full py-2.5"
              onClick={() => navigate('/login')}
            >
              <i
                className="fa-solid fa-right-to-bracket text-xs"
                aria-hidden="true"
              />
              I'd like to log in now
            </PrimaryButton>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <label
              className="block mb-0 text-[var(--text-muted)] text-sm font-medium"
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
              className="block mb-0 text-[var(--text-muted)] text-sm font-medium"
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
