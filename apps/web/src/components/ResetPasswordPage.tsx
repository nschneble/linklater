import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { resetPassword } from '../lib/api';
import { getErrorMessage } from '../lib/errors';
import Alert from './ui/Alert';
import FormInput from './ui/FormInput';
import PrimaryButton from './ui/PrimaryButton';

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
        <h1 className="mb-2 text-[var(--text)] text-center text-2xl font-bold">
          Reset Password
        </h1>
        <p className="mb-6 text-[var(--text-muted)] text-center text-sm">
          Choose a new password for your account.
        </p>

        {success ? (
          <div className="text-center space-y-4">
            <p className="text-[var(--text-muted)]">
              <i
                className="fa-solid fa-circle-check mr-2 text-emerald-500"
                aria-hidden="true"
              />
              Password updated! You can now log in.
            </p>
            <button
              type="button"
              className="text-[var(--accent)] underline text-sm"
              onClick={() => navigate('/')}
            >
              Go to Linklater
            </button>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <label
              htmlFor="reset-password"
              className="block text-[var(--text-muted)] text-sm font-medium"
            >
              New password
            </label>
            <FormInput
              id="reset-password"
              type="password"
              autoComplete="new-password"
              onChange={(event) => setPassword(event.target.value)}
              value={password}
              required
              minLength={12}
            />

            <label
              htmlFor="reset-confirm"
              className="block text-[var(--text-muted)] text-sm font-medium"
            >
              Confirm password
            </label>
            <FormInput
              id="reset-confirm"
              type="password"
              autoComplete="new-password"
              onChange={(event) => setConfirm(event.target.value)}
              value={confirm}
              required
            />

            {error && <Alert variant="error">{error}</Alert>}

            <PrimaryButton disabled={loading} className="w-full py-2.5">
              <i className="fa-solid fa-lock text-xs" aria-hidden="true" />
              {loading ? 'Resetting…' : 'Reset password'}
            </PrimaryButton>

            <p className="text-center">
              <button
                type="button"
                className="text-[var(--text-muted)] text-xs underline"
                onClick={() => navigate('/')}
              >
                Back to login
              </button>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
