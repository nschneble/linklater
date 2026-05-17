import { useAuth } from '../../auth/AuthContext';
import {
  disable2fa,
  regenerateRecoveryCodes,
  setupTotp,
  verifyTotpSetup,
} from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import Alert from '../common/Alert';
import LinkButton from '../common/LinkButton';
import PrimaryButton from '../common/PrimaryButton';
import StatusBadge from '../common/StatusBadge';
import ReauthForm from './ReauthForm';
import RecoveryCodesModal from './RecoveryCodesModal';
import TotpSetupView from './TotpSetupView';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';

type ReauthAction = 'disable' | 'regenerate';

export default function TwoFactorSection() {
  const { refreshUser, user } = useAuth();

  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // TOTP setup state
  const [totpSetup, setTotpSetup] = useState<{
    qrCodeDataUrl: string;
    secret: string;
  } | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const totpCodeInputReference = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (totpSetup) {
      totpCodeInputReference.current?.focus();
    }
  }, [totpSetup]);

  // Re-authentication state (for disable / regenerate)
  const [reauthAction, setReauthAction] = useState<ReauthAction | null>(null);
  const [reauthPassword, setReauthPassword] = useState('');
  const [reauthCode, setReauthCode] = useState('');

  const handleStartTotpSetup = async () => {
    setError(null);
    setLoading(true);
    try {
      const setup = await setupTotp();
      setTotpSetup(setup);
    } catch (caught: unknown) {
      setError(getErrorMessage(caught, 'Failed to initiate TOTP setup'));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyTotp = async (formEvent: FormEvent) => {
    formEvent.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { recoveryCodes: codes } = await verifyTotpSetup(totpCode);
      setTotpSetup(null);
      setTotpCode('');
      setRecoveryCodes(codes);
    } catch (caught: unknown) {
      setError(getErrorMessage(caught, 'Invalid code'));
    } finally {
      setLoading(false);
    }
  };

  const handleReauth = async (formEvent: FormEvent) => {
    formEvent.preventDefault();
    setError(null);
    setLoading(true);
    const credentials = {
      currentPassword: reauthPassword || undefined,
      code: reauthCode || undefined,
    };
    try {
      if (reauthAction === 'disable') {
        await disable2fa(credentials);
        setReauthAction(null);
        setReauthPassword('');
        setReauthCode('');
        await refreshUser();
      } else if (reauthAction === 'regenerate') {
        const { recoveryCodes: codes } =
          await regenerateRecoveryCodes(credentials);
        setReauthAction(null);
        setReauthPassword('');
        setReauthCode('');
        setRecoveryCodes(codes);
      }
    } catch (caught: unknown) {
      setError(getErrorMessage(caught, 'Authentication failed'));
    } finally {
      setLoading(false);
    }
  };

  const handleRecoveryCodesConfirmed = useCallback(async () => {
    setRecoveryCodes(null);
    await refreshUser();
  }, [refreshUser]);

  const handleCancelReauth = useCallback(() => {
    setReauthAction(null);
    setError(null);
  }, []);

  const twoFactorMethod = user?.twoFactorMethod ?? null;
  const twoFactorPending = user?.twoFactorPending ?? false;

  return (
    <div className="max-w-md space-y-4">
      <h2 className="text-[var(--text)] text-xl font-semibold text-balance">
        Two-factor authentication
      </h2>

      {recoveryCodes && (
        <RecoveryCodesModal
          codes={recoveryCodes}
          onConfirm={handleRecoveryCodesConfirmed}
        />
      )}

      {/* Re-authentication form for disable / regenerate */}
      {reauthAction && (
        <ReauthForm
          action={reauthAction}
          code={reauthCode}
          error={error}
          hasPassword={user?.hasPassword ?? false}
          loading={loading}
          onCancel={handleCancelReauth}
          onCodeChange={setReauthCode}
          onPasswordChange={setReauthPassword}
          onSubmit={handleReauth}
          password={reauthPassword}
          twoFactorMethod={twoFactorMethod}
        />
      )}

      {/* State C / E — 2FA enabled */}
      {!reauthAction && twoFactorMethod && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-[var(--text-muted)] text-sm">
              Authenticator app
            </span>
            <StatusBadge variant="success" icon="fa-solid fa-circle-check">
              Enabled
            </StatusBadge>
          </div>
          <div className="flex flex-col gap-2">
            <LinkButton
              onClick={() => {
                setError(null);
                setReauthAction('regenerate');
              }}
            >
              Regenerate recovery codes
            </LinkButton>
            <LinkButton
              onClick={() => {
                setError(null);
                setReauthAction('disable');
              }}
            >
              Disable two-factor authentication
            </LinkButton>
          </div>
        </div>
      )}

      {/* State B — TOTP setup: verify QR */}
      {!reauthAction && !twoFactorMethod && totpSetup && (
        <TotpSetupView
          code={totpCode}
          codeInputReference={totpCodeInputReference}
          error={error}
          loading={loading}
          onCodeChange={setTotpCode}
          onSubmit={handleVerifyTotp}
          qrCodeDataUrl={totpSetup.qrCodeDataUrl}
          secret={totpSetup.secret}
        />
      )}

      {/* State B — TOTP pending from server (setup started in prior session) */}
      {!reauthAction && !twoFactorMethod && !totpSetup && twoFactorPending && (
        <div className="space-y-3">
          <p className="text-[var(--text-muted)] text-sm">
            Authenticator app setup is in progress.
          </p>
          {error && <Alert variant="error">{error}</Alert>}
          <PrimaryButton
            disabled={loading}
            className="py-2.5"
            onClick={handleStartTotpSetup}
          >
            {loading ? 'Loading…' : 'Continue setup'}
          </PrimaryButton>
        </div>
      )}

      {/* State A — 2FA not enabled */}
      {!reauthAction && !twoFactorMethod && !totpSetup && !twoFactorPending && (
        <div className="space-y-3">
          <p className="text-[var(--text-muted)] text-sm">
            Add a second layer of security to your account.
          </p>
          {error && <Alert variant="error">{error}</Alert>}
          <div className="flex items-center gap-2">
            <PrimaryButton
              disabled={loading}
              className="py-2.5"
              onClick={handleStartTotpSetup}
            >
              <i
                className="fa-solid fa-mobile-screen-button text-xs"
                aria-hidden="true"
              />
              Set up authenticator app
            </PrimaryButton>
            <StatusBadge variant="info">Recommended</StatusBadge>
          </div>
        </div>
      )}
    </div>
  );
}
