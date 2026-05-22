import { useAuth } from '../../auth/AuthContext';
import { ApiError, requestEmailChange } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import Alert from '../common/Alert';
import FormInput from '../common/FormInput';
import LinkButton from '../common/LinkButton';
import PrimaryButton from '../common/PrimaryButton';
import StatusBadge from '../common/StatusBadge';
import { useState } from 'react';
import type { FormEvent } from 'react';

/**
 * Email change + verification resend form. Submits to
 * `POST /users/me/email-change`; the API mails a verification link to the
 * new address. On success the pending email is optimistically written into
 * `AuthContext` so the UI reflects the in-progress change without a refetch.
 *
 * Error state lives here (not in the parent) so the inserted `role="alert"`
 * fires its screen-reader announcement reliably.
 */
export default function EmailSettingsForm() {
  const { resendVerificationEmail, setPendingEmail, user } = useAuth();

  const [emailInput, setEmailInput] = useState(user?.email ?? '');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailMessage, setEmailMessage] = useState<string | null>(null);
  const [emailSaving, setEmailSaving] = useState(false);
  const [mfaEmailCode, setMfaEmailCode] = useState('');
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [resendError, setResendError] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  const isVerified = Boolean(user?.emailVerifiedAt);
  const hasPendingEmail = Boolean(user?.pendingEmail);

  async function handleEmailSave(event: FormEvent) {
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
    } catch (caughtError: unknown) {
      if (caughtError instanceof ApiError && caughtError.status === 403) {
        setEmailError(
          getErrorMessage(
            caughtError,
            'A verification code is required to change your email',
          ),
        );
      } else {
        setEmailError(
          getErrorMessage(caughtError, 'Failed to request email change'),
        );
      }
    } finally {
      setEmailSaving(false);
    }
  }

  async function handleResend() {
    setResendError(null);
    setResendMessage(null);
    setResending(true);

    try {
      await resendVerificationEmail();
      setResendMessage('Verification email sent. Check your inbox.');
    } catch (caughtError: unknown) {
      setResendError(
        getErrorMessage(caughtError, 'Failed to resend verification email'),
      );
    } finally {
      setResending(false);
    }
  }

  return (
    <form
      className="space-y-4"
      aria-labelledby="email-settings-heading"
      onSubmit={handleEmailSave}
    >
      <h2
        id="email-settings-heading"
        className="text-[var(--text)] text-sm font-semibold text-balance"
      >
        Email
      </h2>

      <div className="flex items-center gap-2">
        <span className="text-[var(--text-muted)] text-xs">{user?.email}</span>
        {isVerified ? (
          <StatusBadge variant="success" icon="fa-solid fa-circle-check">
            Verified
          </StatusBadge>
        ) : (
          <StatusBadge variant="warning" icon="fa-solid fa-circle-exclamation">
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
          <span className="font-medium">{user?.pendingEmail}</span>. Check your
          inbox to confirm the change.
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
        // only set when the error element exists in the DOM —
        // see LinkForm for the rationale
        aria-describedby={emailError ? 'account-email-error' : undefined}
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
      {emailError && (
        <Alert id="account-email-error" variant="error">
          {emailError}
        </Alert>
      )}

      <PrimaryButton
        disabled={emailSaving || emailInput === user?.email}
        className="py-2.5"
      >
        <i className="fa-solid fa-envelope text-[0.7rem]" aria-hidden="true" />
        {emailSaving ? 'Sending…' : 'Change email'}
      </PrimaryButton>
    </form>
  );
}
