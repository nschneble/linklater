import { requestEmailChange, updateMe } from '../lib/api';
import { getErrorMessage } from '../lib/errors';
import { useAuth } from '../auth/AuthContext';
import { useState, type FormEvent } from 'react';
import Alert from './ui/Alert';
import FormInput from './ui/FormInput';
import PrimaryButton from './ui/PrimaryButton';

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

  const handleEmailSave = async (event: FormEvent) => {
    event.preventDefault();
    if (!emailInput || emailInput === user?.email) {
      setEmailMessage('Nothing to update');
      return;
    }

    setEmailError(null);
    setEmailMessage(null);
    setEmailSaving(true);

    try {
      await requestEmailChange(emailInput);
      setPendingEmail(emailInput);
      setEmailInput(user?.email ?? '');
      setEmailMessage(
        `Verification email sent to ${emailInput}. Check your inbox to confirm the change.`,
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
      <h2 className="text-[var(--text)] text-xl font-semibold">
        Account settings
      </h2>

      <form className="space-y-4" onSubmit={handleEmailSave}>
        <h3 className="text-[var(--text)] text-sm font-semibold">Email</h3>

        <div className="flex items-center gap-2">
          <span className="text-[var(--text-muted)] text-xs">
            {user?.email}
          </span>
          {isVerified ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs rounded-full">
              <i
                className="fa-solid fa-circle-check text-[0.6rem]"
                aria-hidden="true"
              />
              Verified
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs rounded-full">
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
            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className="text-[var(--accent)] text-xs underline disabled:opacity-50"
            >
              {resending ? 'Sending…' : 'Resend verification email'}
            </button>
          </div>
        )}

        {hasPendingEmail && (
          <Alert variant="success">
            Verification email sent to{' '}
            <span className="font-medium">{user?.pendingEmail}</span>. Check
            your inbox to confirm the change.
          </Alert>
        )}

        <label className="block text-[var(--text-muted)] text-xs font-medium">
          Change email
          <FormInput
            type="email"
            value={emailInput}
            onChange={(event) => setEmailInput(event.target.value)}
          />
        </label>

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

      <form className="space-y-4" onSubmit={handlePasswordSave}>
        <h3 className="text-[var(--text)] text-sm font-semibold">Password</h3>

        <label className="block text-[var(--text-muted)] text-xs font-medium">
          New password
          <FormInput
            type="password"
            placeholder="Leave blank to keep current password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>

        {password && (
          <label className="block text-[var(--text-muted)] text-xs font-medium">
            Current password
            <FormInput
              type="password"
              placeholder="Required to confirm password change"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
            />
          </label>
        )}

        {passwordMessage && <Alert variant="success">{passwordMessage}</Alert>}
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
    </div>
  );
}
