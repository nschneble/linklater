import { formatTotpCode, normalizeTotpInput } from '../../lib/totpCode';
import FormInput from '../common/FormInput';
import type { RefObject } from 'react';

// SRs read aria-describedby in order: hint first, error last (WCAG 3.3.1)
function describedBy(
  isRecovery: boolean,
  error: string | null,
): string | undefined {
  if (isRecovery) return error ? 'mfa-error' : undefined;
  return error ? 'mfa-totp-code-hint mfa-error' : 'mfa-totp-code-hint';
}

interface MfaCodeFieldProps {
  error: string | null;
  inputReference: RefObject<HTMLInputElement | null>;
  isRecovery: boolean;
  mfaCode: string;
  onMfaCodeChange: (code: string) => void;
}

export default function MfaCodeField({
  error,
  inputReference,
  isRecovery,
  mfaCode,
  onMfaCodeChange,
}: MfaCodeFieldProps) {
  return (
    <>
      <label
        className="block mb-0 text-[var(--mount-alt-text)] text-sm font-medium"
        htmlFor={isRecovery ? 'mfa-recovery-code' : 'mfa-totp-code'}
      >
        {isRecovery ? 'Recovery code' : 'Authenticator code'}
      </label>
      {!isRecovery && (
        <p
          className="text-[var(--mount-alt-text)] text-xs"
          id="mfa-totp-code-hint"
        >
          We'll verify it automatically after the 6th digit.
        </p>
      )}
      <FormInput
        id={isRecovery ? 'mfa-recovery-code' : 'mfa-totp-code'}
        ref={inputReference}
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
    </>
  );
}
