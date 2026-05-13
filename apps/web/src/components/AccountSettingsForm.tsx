import { requestEmailChange, updateMe } from '../lib/api';
import { getErrorMessage } from '../lib/errors';
import { useAuth } from '../auth/AuthContext';
import { useState, type FormEvent } from 'react';
import Alert from './ui/Alert';
import FormInput from './ui/FormInput';
import LinkButton from './ui/LinkButton';
import PrimaryButton from './ui/PrimaryButton';

/**
 * Settings section for updating email address and password.
 *
 * **Email flow**: submits to `POST /users/me/email-change`. The API sends a
 * verification link to the new address. On success, the pending email is
 * optimistically written into `AuthContext` via `setPendingEmail` so the UI
 * reflects the in-progress change without a refetch. The email input is then
 * reset to the current address (not the pending one) and a success alert is shown.
 *
 * **Password flow**: submits to `PATCH /users/me` with both `currentPassword`
 * and `password`. The current-password field is only rendered once the user
 * starts typing a new password, to keep the form minimal.
 *
 * **Verification resend**: shown only when the current email is unverified.
 * Calls `POST /auth/resend-verification`.
 *
 * Both forms use the standard form state sequence: clear error → set loading
 * → attempt action → handle result.
 */
export default function AccountSettingsForm() {
  const { resendVerificationEmail, setPendingEmail, user } = useAuth();

  const [emailInput, setEmailInput] = useState(user?.email ?? '');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailMessage, setEmailMessage] = useState<string | null>(null);
  const [emailSaving, setEmailSaving] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [resendError, setResendError] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordSaving, setPasswordSaving] = useState(false);

  const isVerified = Boolean(user?.emailVerifiedAt);
  const hasPendingEmail = Boolean(user?.pendingEmail);
  const hasPassword = Boolean(user?.hasPassword);

  const handleEmailSave = async (event: FormEvent) => {
    event.preventDefault();
    if (!emailInput || emailInput === user?.email) {
      setEmailMessage('Nothing to update');
      return;
    }

    const requestedEmail = emailInput;

    setEmailError(null);
    setEmailMessage(null);
    setEmailSaving(true);

    try {
      await requestEmailChange(requestedEmail);
      setPendingEmail(requestedEmail);
      setEmailInput(user?.email ?? '');
      setEmailMessage(
        `Verification email sent to ${requestedEmail}. Check your inbox to confirm the change.`,
      );
    } catch (error: unknown) {
      setEmailError(getErrorMessage(error, 'Failed to request email change'));
    } finally {
      setEmailSaving(false);
    }
  };

  const handleResend = async () => {
    setResendError(null);
    setResendMessage(null);
    setResending(true);

    try {
      await resendVerificationEmail();
      setResendMessage('Verification email sent. Check your inbox.');
    } catch (error: unknown) {
      setResendError(
        getErrorMessage(error, 'Failed to resend verification email'),
      );
    } finally {
      setResending(false);
    }
  };

  const handlePasswordSave = async (event: FormEvent) => {
    event.preventDefault();
    if (!password) {
      setPasswordMessage('Nothing to update');
      return;
    }

    setPasswordError(null);
    setPasswordMessage(null);
    setPasswordSaving(true);

    try {
      await updateMe({ password, currentPassword });
      setCurrentPassword('');
      setPassword('');
      setPasswordMessage('Password updated');
    } catch (error: unknown) {
      setPasswordError(getErrorMessage(error, 'Failed to update password'));
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <div className="max-w-md space-y-8">
      <h2 className="text-[var(--text)] text-xl font-semibold [text-wrap:balance]">
        Account settings
      </h2>

      <form className="space-y-4" onSubmit={handleEmailSave}>
        <h3 className="text-[var(--text)] text-sm font-semibold [text-wrap:balance]">
          Email
        </h3>

        <div className="flex items-center gap-2">
          <span className="text-[var(--text-muted)] text-xs">
            {user?.email}
          </span>
          {isVerified ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 [[data-mode='dark']_&]:bg-emerald-950/20 border border-emerald-300 [[data-mode='dark']_&]:border-emerald-800/40 text-emerald-700 [[data-mode='dark']_&]:text-emerald-400 text-xs rounded-full">
              <i
                className="fa-solid fa-circle-check text-[0.6rem]"
                aria-hidden="true"
              />
              Verified
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 [[data-mode='dark']_&]:bg-amber-950/20 border border-amber-300 [[data-mode='dark']_&]:border-amber-800/40 text-amber-700 [[data-mode='dark']_&]:text-amber-300 text-xs rounded-full">
              <i
                className="fa-solid fa-circle-exclamation text-[0.6rem]"
                aria-hidden="true"
              />
              Unverified
            </span>
          )}
        </div>

        {!isVerified && (
          <div className="space-y-2">
            {resendMessage && <Alert variant="success">{resendMessage}</Alert>}
            {resendError && <Alert variant="error">{resendError}</Alert>}
            <LinkButton disabled={resending} onClick={handleResend}>
              {resending ? 'Sending…' : 'Resend verification email'}
            </LinkButton>
          </div>
        )}

        {hasPendingEmail && (
          <Alert variant="success">
            Verification email sent to{' '}
            <span className="font-medium">{user?.pendingEmail}</span>. Check
            your inbox to confirm the change.
          </Alert>
        )}

        <label
          className="block mb-0 text-[var(--text-muted)] text-xs font-medium"
          htmlFor="change-email"
        >
          Change email
        </label>
        <FormInput
          id="change-email"
          type="email"
          value={emailInput}
          onChange={(event) => setEmailInput(event.target.value)}
        />

        {emailMessage && <Alert variant="success">{emailMessage}</Alert>}
        {emailError && <Alert variant="error">{emailError}</Alert>}

        <PrimaryButton
          disabled={emailSaving || emailInput === user?.email}
          className="py-2.5"
        >
          <i
            className="fa-solid fa-envelope text-[0.7rem]"
            aria-hidden="true"
          />
          {emailSaving ? 'Sending…' : 'Change email'}
        </PrimaryButton>
      </form>

      {hasPassword ? (
        <form className="space-y-4" onSubmit={handlePasswordSave}>
          <h3 className="text-[var(--text)] text-sm font-semibold [text-wrap:balance]">
            Password
          </h3>

          <label
            className="block mb-0 text-[var(--text-muted)] text-xs font-medium"
            htmlFor="new-password"
          >
            New password
          </label>
          <FormInput
            id="new-password"
            type="password"
            placeholder="Leave blank to keep current password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />

          {password && (
            <>
              <label
                className="block mb-0 text-[var(--text-muted)] text-xs font-medium"
                htmlFor="current-password"
              >
                Current password
              </label>
              <FormInput
                id="current-password"
                type="password"
                placeholder="Required to confirm password change"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                required
              />
            </>
          )}

          {passwordMessage && (
            <Alert variant="success">{passwordMessage}</Alert>
          )}
          {passwordError && <Alert variant="error">{passwordError}</Alert>}

          <PrimaryButton
            disabled={passwordSaving || !password}
            className="py-2.5"
          >
            <i
              className="fa-solid fa-floppy-disk text-[0.7rem]"
              aria-hidden="true"
            />
            {passwordSaving ? 'Saving…' : 'Update password'}
          </PrimaryButton>
        </form>
      ) : (
        <div className="space-y-2">
          <h3 className="text-[var(--text)] text-sm font-semibold [text-wrap:balance]">
            Password
          </h3>
          <p className="text-[var(--text-muted)] text-xs">
            Your account uses social sign-in — no password is set.
          </p>
        </div>
      )}
    </div>
  );
}
