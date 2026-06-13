import Alert from '../common/Alert';
import FormInput from '../common/FormInput';
import LinkButton from '../common/LinkButton';
import PrimaryButton from '../common/PrimaryButton';
import AuthCard from './AuthCard';
import { formatTotpCode, normalizeTotpInput } from '../../lib/totpCode';
import { useEffect, useRef } from 'react';
import type { FormEvent, RefObject } from 'react';

// Wires `aria-describedby` for the TOTP input. SRs announce describedby
// targets in order, so hint first + error second means the error is the
// last thing heard before the user retries (WCAG 3.3.1 friendly).
function describedBy(
  isRecovery: boolean,
  error: string | null,
): string | undefined {
  if (isRecovery) return error ? 'mfa-error' : undefined;
  return error ? 'mfa-totp-code-hint mfa-error' : 'mfa-totp-code-hint';
}

interface MfaViewProps {
  error: string | null;
  errorReference: RefObject<HTMLParagraphElement | null>;
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
  errorReference,
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
      <h1 className="mb-2 text-[var(--mount-text)] text-center text-2xl font-bold text-balance">
        {isRecovery ? 'Enter a recovery code' : 'Multi-factor authentication'}
      </h1>
      <p className="mb-6 text-[var(--mount-alt-text)] text-center text-sm">
        {isRecovery
          ? 'Enter one of your saved recovery codes.'
          : 'Enter the code from your authenticator app.'}
      </p>

      <form ref={formReference} className="space-y-4" onSubmit={onSubmit}>
        <label
          className="block mb-0 text-[var(--mount-alt-text)] text-sm font-medium"
          htmlFor={isRecovery ? 'mfa-recovery-code' : 'mfa-totp-code'}
        >
          {isRecovery ? 'Recovery code' : 'Authenticator code'}
        </label>
        {!isRecovery && (
          // --*-subtle-text is BASE-only by design; mount hints collapse to alt-text
          <p
            className="text-[var(--mount-alt-text)] text-xs"
            id="mfa-totp-code-hint"
          >
            We'll verify it automatically after the 6th digit.
          </p>
        )}
        <FormInput
          id={isRecovery ? 'mfa-recovery-code' : 'mfa-totp-code'}
          ref={mfaInputReference}
          type="text"
          surface="mount"
          inputMode={isRecovery ? 'text' : 'numeric'}
          autoComplete={isRecovery ? 'off' : 'one-time-code'}
          maxLength={isRecovery ? undefined : 7}
          placeholder={isRecovery ? undefined : '000 000'}
          onChange={(event) =>
            onMfaCodeChange(
              isRecovery
                ? event.target.value
                : normalizeTotpInput(event.target.value),
            )
          }
          value={isRecovery ? mfaCode : formatTotpCode(mfaCode)}
          required
          aria-describedby={describedBy(isRecovery, error)}
        />

        {error && (
          <Alert
            id="mfa-error"
            ref={errorReference}
            icon="fa-triangle-exclamation"
            tabIndex={-1}
            variant="error"
          >
            {error}
          </Alert>
        )}

        <PrimaryButton disabled={loading} className="w-full py-2.5">
          <i className="fa-solid fa-shield-halved text-xs" aria-hidden="true" />
          {loading ? 'Verifying…' : 'Verify'}
        </PrimaryButton>
      </form>

      <div className="flex flex-col items-center gap-2 mt-4 text-center">
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
