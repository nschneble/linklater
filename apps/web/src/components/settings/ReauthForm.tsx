import { useState, type FormEvent } from 'react';
import Alert from '../common/Alert';
import FormInput from '../common/FormInput';
import LinkButton from '../common/LinkButton';
import PrimaryButton from '../common/PrimaryButton';
import { sendReauthEmailCode } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';

type ReauthAction = 'disable' | 'regenerate';

interface ReauthFormProps {
  action: ReauthAction;
  hasPassword: boolean;
  twoFactorMethod: 'totp' | 'email' | null;
  loading: boolean;
  error: string | null;
  password: string;
  code: string;
  onPasswordChange: (value: string) => void;
  onCodeChange: (value: string) => void;
  onSubmit: (formEvent: FormEvent) => void;
  onCancel: () => void;
}

export default function ReauthForm({
  action,
  code,
  error,
  hasPassword,
  loading,
  onCancel,
  onCodeChange,
  onPasswordChange,
  onSubmit,
  password,
  twoFactorMethod,
}: ReauthFormProps) {
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailSendError, setEmailSendError] = useState<string | null>(null);

  const handleSendEmailCode = async () => {
    setEmailSendError(null);
    setEmailSending(true);
    try {
      await sendReauthEmailCode();
      setEmailSent(true);
    } catch (caught: unknown) {
      setEmailSendError(getErrorMessage(caught, 'Failed to send code'));
    } finally {
      setEmailSending(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <p className="text-[var(--text-muted)] text-sm">
        {action === 'disable'
          ? 'Confirm your identity to disable two-factor authentication.'
          : 'Confirm your identity to regenerate recovery codes.'}
      </p>

      {hasPassword && (
        <>
          <label
            className="block mb-0 text-[var(--text-muted)] text-xs font-medium"
            htmlFor="reauth-password"
          >
            Current password
          </label>
          <FormInput
            id="reauth-password"
            type="password"
            value={password}
            onChange={(event) => onPasswordChange(event.target.value)}
          />
        </>
      )}

      <label
        className="block mb-0 text-[var(--text-muted)] text-xs font-medium"
        htmlFor="reauth-code"
      >
        {hasPassword ? 'Or enter your ' : 'Enter your '}
        {twoFactorMethod === 'email' ? 'email' : 'authenticator'} or recovery
        code
      </label>

      {twoFactorMethod === 'email' && !emailSent && (
        <div className="space-y-2">
          {emailSendError && <Alert variant="error">{emailSendError}</Alert>}
          <LinkButton disabled={emailSending} onClick={handleSendEmailCode}>
            {emailSending ? 'Sending…' : 'Send me a code'}
          </LinkButton>
        </div>
      )}

      {twoFactorMethod === 'email' && emailSent && (
        <p className="text-[var(--text-muted)] text-xs">
          Code sent to your email.
        </p>
      )}

      <FormInput
        id="reauth-code"
        type="text"
        maxLength={17}
        value={code}
        onChange={(event) => onCodeChange(event.target.value)}
      />

      {error && <Alert variant="error">{error}</Alert>}

      <div className="flex gap-3">
        <PrimaryButton
          disabled={
            loading ||
            (twoFactorMethod === 'email' && !emailSent && !password) ||
            (twoFactorMethod === 'email' && emailSent && !code && !password)
          }
          className="py-2.5"
        >
          {loading ? 'Working…' : 'Confirm'}
        </PrimaryButton>
        <LinkButton onClick={onCancel}>Cancel</LinkButton>
      </div>
    </form>
  );
}
