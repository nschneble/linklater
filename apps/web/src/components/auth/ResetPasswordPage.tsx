import { FULL_SCREEN_CENTER } from '../../lib/styles';
import LoadingScreen from '../common/LoadingScreen';
import MfaStep from './MfaStep';
import ResetPasswordForm from './ResetPasswordForm';
import { useDocumentTitle } from '../../lib/hooks/useDocumentTitle';
import { useResetPasswordForm } from './useResetPasswordForm';

/**
 * The `/reset-password?token=…` route; open without auth. Tokens last an
 * hour. Success signs the user in (TOTP accounts hit MFA first), and
 * submitting swaps the form for a loading screen so the redirect never
 * flashes the card.
 */
export default function ResetPasswordPage() {
  useDocumentTitle('Linklater – Reset password');

  const {
    confirm,
    confirmMismatch,
    error,
    errorReference,
    failedSubmitCount,
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
      <LoadingScreen
        focusOnMount
        statusText="Resetting your password…"
        theme="branding"
      />
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

        <ResetPasswordForm
          confirm={confirm}
          confirmMismatch={confirmMismatch}
          error={error}
          errorReference={errorReference}
          failedSubmitCount={failedSubmitCount}
          onConfirmChange={setConfirm}
          onPasswordChange={setPassword}
          onSubmit={handleSubmit}
          password={password}
        />
      </div>
    </main>
  );
}
