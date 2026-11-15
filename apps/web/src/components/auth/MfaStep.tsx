import { FULL_SCREEN_CENTER } from '../../lib/styles';
import { getErrorMessage } from '../../lib/errors';
import MfaView from './MfaView';
import { setPendingNotice } from '../../lib/pendingNotice';
import { useAuth } from '../../auth/AuthContext';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { verifyOtp } from '../../lib/api';
import type { MfaChallenge } from './useAuthForm';
import type { PendingNotice } from '../../lib/pendingNotice';

interface MfaStepProps {
  branded?: boolean;
  mfaMethod: MfaChallenge;
  mfaToken: string;
  successNotice?: PendingNotice;
}

export default function MfaStep({
  branded = false,
  mfaMethod,
  mfaToken,
  successNotice,
}: MfaStepProps) {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [mfaChallenge, setMfaChallenge] = useState<MfaChallenge>(mfaMethod);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaError, setMfaError] = useState<string | null>(null);
  const mfaErrorReference = useRef<HTMLParagraphElement>(null);
  const mfaInputReference = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (mfaError) {
      mfaErrorReference.current?.focus();
    }
  }, [mfaError]);

  const handleVerifyOtp = async (formEvent: FormEvent) => {
    formEvent.preventDefault();
    setMfaError(null);
    setMfaLoading(true);
    try {
      await verifyOtp(mfaToken, mfaCode, mfaChallenge);
      await refreshUser();
      setMfaCode('');
      if (successNotice) setPendingNotice(successNotice);
      navigate('/unread', { replace: true });
    } catch (caughtError: unknown) {
      setMfaError(getErrorMessage(caughtError, 'Invalid code'));
      setMfaCode('');
    } finally {
      setMfaLoading(false);
    }
  };

  const switchChallenge = (challenge: MfaChallenge) => {
    setMfaChallenge(challenge);
    setMfaCode('');
    setMfaError(null);
  };

  const mfaView = (
    <MfaView
      error={mfaError}
      errorReference={mfaErrorReference}
      loading={mfaLoading}
      mfaChallenge={mfaChallenge}
      mfaCode={mfaCode}
      mfaInputReference={mfaInputReference}
      onMfaCodeChange={setMfaCode}
      onSubmit={handleVerifyOtp}
      onSwitchToRecovery={() => switchChallenge('recovery')}
      onSwitchToTotp={() => switchChallenge('totp')}
    />
  );

  if (!branded) return mfaView;

  return (
    <main
      data-theme="branding"
      className={`${FULL_SCREEN_CENTER} px-4 py-4 bg-gradient-to-b from-[var(--page-gradient-from)] to-[var(--page-gradient-to)]`}
    >
      <div className="w-full m-auto">{mfaView}</div>
    </main>
  );
}
