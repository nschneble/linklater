import type { FormEvent } from 'react';
import Alert from '../common/Alert';
import FormInput from '../common/FormInput';
import LinkButton from '../common/LinkButton';
import PrimaryButton from '../common/PrimaryButton';

type EmailTwoFactorFlow = 'send' | 'verify';

interface EmailTwoFactorSetupViewProps {
  emailTwoFactorFlow: EmailTwoFactorFlow;
  userEmail: string;
  code: string;
  loading: boolean;
  error: string | null;
  onCodeChange: (value: string) => void;
  onSendCode: (formEvent: FormEvent) => void;
  onVerify: (formEvent: FormEvent) => void;
  onCancel: () => void;
}

export default function EmailTwoFactorSetupView({
  code,
  emailTwoFactorFlow,
  error,
  loading,
  onCancel,
  onCodeChange,
  onSendCode,
  onVerify,
  userEmail,
}: EmailTwoFactorSetupViewProps) {
  if (emailTwoFactorFlow === 'send') {
    return (
      <form className="space-y-4" onSubmit={onSendCode}>
        <p className="text-[var(--text-muted)] text-sm">
          We'll send a one-time code to{' '}
          <span className="font-medium">{userEmail}</span>.
        </p>
        {error && <Alert variant="error">{error}</Alert>}
        <div className="flex gap-3">
          <PrimaryButton disabled={loading} className="py-2.5">
            {loading ? 'Sending…' : 'Send code'}
          </PrimaryButton>
          <LinkButton onClick={onCancel}>Cancel</LinkButton>
        </div>
      </form>
    );
  }

  return (
    <form className="space-y-4" onSubmit={onVerify}>
      <p className="text-[var(--text-muted)] text-sm">
        Enter the 6-digit code we sent to{' '}
        <span className="font-medium">{userEmail}</span>.
      </p>
      <label
        className="block mb-0 text-[var(--text-muted)] text-xs font-medium"
        htmlFor="email-2fa-code"
      >
        Email code
      </label>
      <FormInput
        id="email-2fa-code"
        type="text"
        inputMode="numeric"
        maxLength={6}
        value={code}
        onChange={(event) => onCodeChange(event.target.value)}
        required
      />
      {error && <Alert variant="error">{error}</Alert>}
      <PrimaryButton disabled={loading} className="py-2.5">
        {loading ? 'Verifying…' : 'Verify'}
      </PrimaryButton>
    </form>
  );
}
