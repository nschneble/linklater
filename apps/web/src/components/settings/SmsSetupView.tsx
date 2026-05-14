import { type FormEvent } from 'react';
import Alert from '../common/Alert';
import FormInput from '../common/FormInput';
import LinkButton from '../common/LinkButton';
import PrimaryButton from '../common/PrimaryButton';

type SmsFlow = 'phone' | 'code';

interface SmsSetupViewProps {
  smsFlow: SmsFlow;
  phoneNumber: string;
  smsCode: string;
  loading: boolean;
  error: string | null;
  onPhoneChange: (value: string) => void;
  onSmsCodeChange: (value: string) => void;
  onSendCode: (formEvent: FormEvent) => void;
  onVerify: (formEvent: FormEvent) => void;
  onCancel: () => void;
}

export default function SmsSetupView({
  error,
  loading,
  onCancel,
  onPhoneChange,
  onSendCode,
  onSmsCodeChange,
  onVerify,
  phoneNumber,
  smsCode,
  smsFlow,
}: SmsSetupViewProps) {
  if (smsFlow === 'phone') {
    return (
      <form className="space-y-4" onSubmit={onSendCode}>
        <label
          className="block mb-0 text-[var(--text-muted)] text-xs font-medium"
          htmlFor="sms-phone"
        >
          Phone number
        </label>
        <FormInput
          id="sms-phone"
          type="tel"
          placeholder="+1 555 555 0100"
          value={phoneNumber}
          onChange={(event) => onPhoneChange(event.target.value)}
          required
        />
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
        Enter the code we sent to{' '}
        <span className="font-medium">{phoneNumber}</span>.
      </p>
      <label
        className="block mb-0 text-[var(--text-muted)] text-xs font-medium"
        htmlFor="sms-code"
      >
        SMS code
      </label>
      <FormInput
        id="sms-code"
        type="text"
        inputMode="numeric"
        maxLength={6}
        value={smsCode}
        onChange={(event) => onSmsCodeChange(event.target.value)}
        required
      />
      {error && <Alert variant="error">{error}</Alert>}
      <PrimaryButton disabled={loading} className="py-2.5">
        {loading ? 'Verifying…' : 'Verify'}
      </PrimaryButton>
    </form>
  );
}
