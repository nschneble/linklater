import Alert from '../common/Alert';
import FormInput from '../common/FormInput';
import LinkButton from '../common/LinkButton';
import PrimaryButton from '../common/PrimaryButton';
import AuthCard from './AuthCard';
import { useEffect, useRef } from 'react';
import type { FormEvent, RefObject } from 'react';

interface MfaViewProps {
  error: string | null;
  loading: boolean;
  mfaChallenge: 'totp' | 'recovery';
  mfaCode: string;
  mfaInputReference: RefObject<HTMLInputElement | null>;
  onMfaCodeChange: (code: string) => void;
  onSubmit: (event: FormEvent) => void;
  onSwitchToRecovery: () => void;
  onSwitchToTotp: () => void;
}

export default function MfaView({
  error,
  loading,
  mfaChallenge,
  mfaCode,
  mfaInputReference,
  onMfaCodeChange,
  onSubmit,
  onSwitchToRecovery,
  onSwitchToTotp,
}: MfaViewProps) {
  const isRecovery = mfaChallenge === 'recovery';
  const formReference = useRef<HTMLFormElement>(null);

  useEffect(() => {
    // Auto-submit only for TOTP (6-digit numeric) — recovery codes have no fixed length.
    if (!isRecovery && !loading && /^\d{6}$/.test(mfaCode)) {
      formReference.current?.requestSubmit();
    }
  }, [mfaCode, isRecovery, loading]);

  return (
    <AuthCard>
      <h1 className="mb-2 text-[var(--text)] text-center text-2xl font-bold text-balance">
        {isRecovery ? 'Enter a recovery code' : 'Two-factor authentication'}
      </h1>
      <p className="mb-6 text-[var(--text-muted)] text-center text-sm">
        {isRecovery
          ? 'Enter one of your saved recovery codes.'
          : 'Enter the code from your authenticator app.'}
      </p>

      <form ref={formReference} className="space-y-4" onSubmit={onSubmit}>
        <label
          className="block mb-0 text-[var(--text-muted)] text-sm font-medium"
          htmlFor={isRecovery ? 'mfa-recovery-code' : 'mfa-totp-code'}
        >
          {isRecovery ? 'Recovery code' : 'Authenticator code'}
        </label>
        <FormInput
          id={isRecovery ? 'mfa-recovery-code' : 'mfa-totp-code'}
          ref={mfaInputReference}
          type="text"
          inputMode={isRecovery ? 'text' : 'numeric'}
          autoComplete={isRecovery ? 'off' : 'one-time-code'}
          maxLength={isRecovery ? undefined : 6}
          onChange={(event) => onMfaCodeChange(event.target.value)}
          value={mfaCode}
          required
        />

        {error && (
          <Alert icon="fa-triangle-exclamation" variant="error">
            {error}
          </Alert>
        )}

        <PrimaryButton disabled={loading} className="w-full py-2.5">
          {loading ? 'Verifying…' : 'Verify'}
        </PrimaryButton>
      </form>

      <div className="mt-4 flex flex-col items-center gap-2 text-center">
        {!isRecovery && (
          <LinkButton onClick={onSwitchToRecovery}>
            Use a recovery code
          </LinkButton>
        )}
        {isRecovery && (
          <LinkButton onClick={onSwitchToTotp}>
            Use a different method
          </LinkButton>
        )}
      </div>
    </AuthCard>
  );
}
