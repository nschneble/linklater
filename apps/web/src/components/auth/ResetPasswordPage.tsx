import Alert from '../common/Alert';
import FormInput from '../common/FormInput';
import { FULL_SCREEN_CENTER } from '../../lib/styles';
import LinkButton from '../common/LinkButton';
import LoadingScreen from '../common/LoadingScreen';
import PrimaryButton from '../common/PrimaryButton';
import ResetPasswordMfaStep from './ResetPasswordMfaStep';
import { useDocumentTitle } from '../../lib/hooks/useDocumentTitle';
import { useNavigate } from 'react-router';
import { useResetPasswordForm } from './useResetPasswordForm';

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

  const navigate = useNavigate();
  const {
    confirm,
    error,
    handleSubmit,
    loading,
    password,
    pendingMfa,
    setConfirm,
    setPassword,
  } = useResetPasswordForm();

  if (pendingMfa) {
    return (
      <ResetPasswordMfaStep
        mfaMethod={pendingMfa.mfaMethod}
        mfaToken={pendingMfa.mfaToken}
      />
    );
  }

  if (loading) {
    return (
      <LoadingScreen statusText="Resetting your password…" theme="branding" />
    );
  }

  // "branding" pins the surface so no stale film/custom palette leaks in
  return (
    <div
      data-theme="branding"
      className={`${FULL_SCREEN_CENTER} px-4 py-4 bg-gradient-to-b from-[var(--page-gradient-from)] to-[var(--page-gradient-to)]`}
    >
      <div className="w-full max-w-md m-auto p-8 bg-[var(--mount-bg)] border-shadow rounded-2xl select-none">
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
