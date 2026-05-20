import { useEffect, useRef } from 'react';
import type { FormEvent, RefObject } from 'react';
import Alert from '../common/Alert';
import FormInput from '../common/FormInput';
import PrimaryButton from '../common/PrimaryButton';

interface TotpSetupViewProps {
  qrCodeDataUrl: string;
  secret: string;
  code: string;
  codeInputReference: RefObject<HTMLInputElement | null>;
  loading: boolean;
  error: string | null;
  onCodeChange: (value: string) => void;
  onSubmit: (formEvent: FormEvent) => void;
}

export default function TotpSetupView({
  code,
  codeInputReference,
  error,
  loading,
  onCodeChange,
  onSubmit,
  qrCodeDataUrl,
  secret,
}: TotpSetupViewProps) {
  const formReference = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (/^\d{6}$/.test(code)) {
      formReference.current?.requestSubmit();
    }
  }, [code]);

  return (
    <div className="space-y-4">
      <p className="text-[var(--text-muted)] text-sm">
        Scan the QR code with your authenticator app, then enter the 6-digit
        code to confirm.
      </p>
      <img
        src={qrCodeDataUrl}
        alt="TOTP QR code"
        className="w-40 h-40 rounded border border-[var(--border)]"
      />
      <div>
        <p className="text-[var(--text-muted)] text-xs mb-1">
          Or enter this secret manually:
        </p>
        <code className="block px-3 py-2 bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text)] text-xs font-mono rounded select-all">
          {secret}
        </code>
      </div>
      <form ref={formReference} className="space-y-3" onSubmit={onSubmit}>
        <label
          className="block mb-0 text-[var(--text-muted)] text-xs font-medium"
          htmlFor="totp-code"
        >
          Verification code
        </label>
        <FormInput
          id="totp-code"
          ref={codeInputReference}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
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
    </div>
  );
}
