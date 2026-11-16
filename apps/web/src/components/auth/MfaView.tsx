import Alert from '../common/Alert';
import AuthCard from './AuthCard';
import MfaChallengeSwitch from './MfaChallengeSwitch';
import MfaCodeField from './MfaCodeField';
import PrimaryButton from '../common/PrimaryButton';
import { useEffect, useRef } from 'react';
import type { FormEvent, RefObject } from 'react';

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
    // TOTP auto-submits at 6 digits; recovery codes have no fixed length
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
        <MfaCodeField
          error={error}
          inputReference={mfaInputReference}
          isRecovery={isRecovery}
          mfaCode={mfaCode}
          onMfaCodeChange={onMfaCodeChange}
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

      <MfaChallengeSwitch
        isRecovery={isRecovery}
        onSwitchToRecovery={onSwitchToRecovery}
        onSwitchToTotp={onSwitchToTotp}
      />
    </AuthCard>
  );
}
