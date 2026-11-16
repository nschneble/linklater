import Alert from '../common/Alert';
import FormInput from '../common/FormInput';
import { FULL_SCREEN_CENTER } from '../../lib/styles';
import LinkButton from '../common/LinkButton';
import LoadingScreen from '../common/LoadingScreen';
import MfaStep from './MfaStep';
import PrimaryButton from '../common/PrimaryButton';
import { useDocumentTitle } from '../../lib/hooks/useDocumentTitle';
import { useNavigate } from 'react-router';
import { useResetPasswordForm } from './useResetPasswordForm';

/**
 * The `/reset-password?token=…` route; open without auth. Tokens last an
 * hour. Success signs the user in (TOTP accounts hit MFA first), and
 * submitting swaps the form for a loading screen so the redirect never
 * flashes the card.
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
      <MfaStep
        branded
        mfaMethod={pendingMfa.mfaMethod}
        mfaToken={pendingMfa.mfaToken}
        successNotice="password-reset-success"
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
    <main
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
    </main>
  );
}
