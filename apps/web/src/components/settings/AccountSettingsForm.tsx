import { useAuth } from '../../auth/AuthContext';
import {
  ApiError,
  requestEmailChange,
  setPassword as apiSetPassword,
  updateMe,
} from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import Alert from '../common/Alert';
import FormInput from '../common/FormInput';
import LinkButton from '../common/LinkButton';
import PrimaryButton from '../common/PrimaryButton';
import StatusBadge from '../common/StatusBadge';
import { useState, type FormEvent } from 'react';

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
  const { refreshUser, resendVerificationEmail, setPendingEmail, user } =
    useAuth();

  const [emailInput, setEmailInput] = useState(user?.email ?? '');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailMessage, setEmailMessage] = useState<string | null>(null);
  const [emailSaving, setEmailSaving] = useState(false);
  const [mfaEmailCode, setMfaEmailCode] = useState('');
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [resendError, setResendError] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordSaving, setPasswordSaving] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [addPasswordError, setAddPasswordError] = useState<string | null>(null);
  const [addPasswordSaving, setAddPasswordSaving] = useState(false);

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
      if (user?.twoFactorMethod) {
        await requestEmailChange(requestedEmail, mfaEmailCode);
      } else {
        await requestEmailChange(requestedEmail);
      }
      setPendingEmail(requestedEmail);
      setEmailInput(user?.email ?? '');
      setMfaEmailCode('');
      setEmailMessage(
        `Verification email sent to ${requestedEmail}. Check your inbox to confirm the change.`,
      );
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === 403) {
        setEmailError(
          getErrorMessage(
            error,
            'A verification code is required to change your email',
          ),
        );
      } else {
        setEmailError(getErrorMessage(error, 'Failed to request email change'));
      }
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

  const handleAddPassword = async (event: FormEvent) => {
    event.preventDefault();

    setAddPasswordError(null);
    setAddPasswordSaving(true);

    try {
      await apiSetPassword(newPassword);
      setNewPassword('');
      await refreshUser();
    } catch (error: unknown) {
      setAddPasswordError(getErrorMessage(error, 'Failed to set password'));
    } finally {
      setAddPasswordSaving(false);
    }
  };

  return (
    <div className="max-w-md space-y-8">
      <h1 className="text-[var(--text)] text-xl font-semibold text-balance">
        Account settings
      </h1>

      <form className="space-y-4" onSubmit={handleEmailSave}>
        <h2 className="text-[var(--text)] text-sm font-semibold text-balance">
          Email
        </h2>

        <div className="flex items-center gap-2">
          <span className="text-[var(--text-muted)] text-xs">
            {user?.email}
          </span>
          {isVerified ? (
            <StatusBadge variant="success" icon="fa-solid fa-circle-check">
              Verified
            </StatusBadge>
          ) : (
            <StatusBadge
              variant="warning"
              icon="fa-solid fa-circle-exclamation"
            >
              Unverified
            </StatusBadge>
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

        {user?.twoFactorMethod && (
          <>
            <label
              className="block mb-0 text-[var(--text-muted)] text-xs font-medium"
              htmlFor="email-change-mfa"
            >
              Authenticator or recovery code
            </label>
            <FormInput
              id="email-change-mfa"
              type="text"
              maxLength={17}
              placeholder="Required to confirm email change"
              value={mfaEmailCode}
              onChange={(event) => setMfaEmailCode(event.target.value)}
            />
          </>
        )}

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
          <h2 className="text-[var(--text)] text-sm font-semibold text-balance">
            Password
          </h2>

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
        <form className="space-y-4" onSubmit={handleAddPassword}>
          <h2 className="text-[var(--text)] text-sm font-semibold text-balance">
            Password
          </h2>
          <p className="text-[var(--text-muted)] text-xs">
            Add a password for backup access alongside social sign-in.
          </p>

          <label
            className="block mb-0 text-[var(--text-muted)] text-xs font-medium"
            htmlFor="add-password-input"
          >
            New password
          </label>
          <FormInput
            id="add-password-input"
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />

          {addPasswordError && (
            <Alert variant="error">{addPasswordError}</Alert>
          )}

          <PrimaryButton
            disabled={addPasswordSaving || !newPassword}
            className="py-2.5"
          >
            <i className="fa-solid fa-key text-[0.7rem]" aria-hidden="true" />
            {addPasswordSaving ? 'Saving…' : 'Add password'}
          </PrimaryButton>
        </form>
      )}
    </div>
  );
}
