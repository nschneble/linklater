import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import Alert from '../common/Alert';
import FormInput from '../common/FormInput';
import LinkButton from '../common/LinkButton';
import PrimaryButton from '../common/PrimaryButton';
import {
  disable2fa,
  regenerateRecoveryCodes,
  setupSms,
  setupTotp,
  verifySmsSetup,
  verifyTotpSetup,
} from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import { useAuth } from '../../auth/AuthContext';

type SmsFlow = 'phone' | 'code';
type ReauthAction = 'disable' | 'regenerate';

function RecoveryCodesModal({
  codes,
  onConfirm,
}: {
  codes: string[];
  onConfirm: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(codes.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [codes]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="recovery-codes-title"
    >
      <div className="w-full max-w-md mx-4 p-6 bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl shadow-xl space-y-4">
        <h3
          id="recovery-codes-title"
          className="text-[var(--text)] text-lg font-semibold"
        >
          Save your recovery codes
        </h3>
        <p className="text-[var(--text-muted)] text-sm">
          Store these codes somewhere safe. Each can be used once to access your
          account if you lose your 2FA device.
        </p>
        <ul className="grid grid-cols-2 gap-2">
          {codes.map((code) => (
            <li
              key={code}
              className="px-3 py-1.5 bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text)] text-xs font-mono rounded"
            >
              {code}
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-[var(--text-muted)] text-xs hover:text-[var(--text)] transition"
        >
          <i
            className={`fa-solid ${copied ? 'fa-check' : 'fa-copy'} text-[0.65rem]`}
            aria-hidden="true"
          />
          {copied ? 'Copied!' : 'Copy all codes'}
        </button>
        <PrimaryButton className="w-full py-2.5" onClick={onConfirm}>
          I&apos;ve saved these codes
        </PrimaryButton>
      </div>
    </div>
  );
}

function EnabledBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 [[data-mode='dark']_&]:bg-emerald-950/20 border border-emerald-300 [[data-mode='dark']_&]:border-emerald-800/40 text-emerald-700 [[data-mode='dark']_&]:text-emerald-400 text-xs rounded-full">
      <i
        className="fa-solid fa-circle-check text-[0.6rem]"
        aria-hidden="true"
      />
      Enabled
    </span>
  );
}

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

  // SMS setup state
  const [smsFlow, setSmsFlow] = useState<SmsFlow | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [smsCode, setSmsCode] = useState('');

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

  const handleStartSmsSetup = () => {
    setError(null);
    setSmsFlow('phone');
  };

  const handleSendSmsCode = async (formEvent: FormEvent) => {
    formEvent.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await setupSms(phoneNumber);
      setSmsFlow('code');
    } catch (caught: unknown) {
      setError(getErrorMessage(caught, 'Failed to send SMS code'));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifySms = async (formEvent: FormEvent) => {
    formEvent.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { recoveryCodes: codes } = await verifySmsSetup(smsCode);
      setSmsFlow(null);
      setPhoneNumber('');
      setSmsCode('');
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

  const handleRecoveryCodesConfirmed = async () => {
    setRecoveryCodes(null);
    await refreshUser();
  };

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
        <form className="space-y-4" onSubmit={handleReauth}>
          <p className="text-[var(--text-muted)] text-sm">
            {reauthAction === 'disable'
              ? 'Confirm your identity to disable two-factor authentication.'
              : 'Confirm your identity to regenerate recovery codes.'}
          </p>

          {user?.hasPassword && (
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
                value={reauthPassword}
                onChange={(event) => setReauthPassword(event.target.value)}
              />
            </>
          )}

          <label
            className="block mb-0 text-[var(--text-muted)] text-xs font-medium"
            htmlFor="reauth-code"
          >
            {user?.hasPassword ? 'Or enter your ' : 'Enter your '}
            {twoFactorMethod === 'sms' ? 'SMS' : 'authenticator'} code
          </label>
          <FormInput
            id="reauth-code"
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={reauthCode}
            onChange={(event) => setReauthCode(event.target.value)}
          />

          {error && <Alert variant="error">{error}</Alert>}

          <div className="flex gap-3">
            <PrimaryButton disabled={loading} className="py-2.5">
              {loading ? 'Working…' : 'Confirm'}
            </PrimaryButton>
            <LinkButton
              onClick={() => {
                setReauthAction(null);
                setError(null);
              }}
            >
              Cancel
            </LinkButton>
          </div>
        </form>
      )}

      {/* State C / E — 2FA enabled */}
      {!reauthAction && twoFactorMethod && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-[var(--text-muted)] text-sm">
              {twoFactorMethod === 'totp'
                ? 'Authenticator app'
                : 'SMS text message'}
            </span>
            <EnabledBadge />
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
        <div className="space-y-4">
          <p className="text-[var(--text-muted)] text-sm">
            Scan the QR code with your authenticator app, then enter the 6-digit
            code to confirm.
          </p>
          <img
            src={totpSetup.qrCodeDataUrl}
            alt="TOTP QR code"
            className="w-40 h-40 rounded border border-[var(--border)]"
          />
          <div>
            <p className="text-[var(--text-muted)] text-xs mb-1">
              Or enter this secret manually:
            </p>
            <code className="block px-3 py-2 bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text)] text-xs font-mono rounded select-all">
              {totpSetup.secret}
            </code>
          </div>
          <form className="space-y-3" onSubmit={handleVerifyTotp}>
            <label
              className="block mb-0 text-[var(--text-muted)] text-xs font-medium"
              htmlFor="totp-code"
            >
              Verification code
            </label>
            <FormInput
              id="totp-code"
              ref={totpCodeInputReference}
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={totpCode}
              onChange={(event) => setTotpCode(event.target.value)}
              required
            />
            {error && <Alert variant="error">{error}</Alert>}
            <PrimaryButton disabled={loading} className="py-2.5">
              {loading ? 'Verifying…' : 'Verify'}
            </PrimaryButton>
          </form>
        </div>
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

      {/* State D — SMS setup: phone or code */}
      {!reauthAction &&
        !twoFactorMethod &&
        !totpSetup &&
        !twoFactorPending &&
        smsFlow === 'phone' && (
          <form className="space-y-4" onSubmit={handleSendSmsCode}>
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
              onChange={(event) => setPhoneNumber(event.target.value)}
              required
            />
            {error && <Alert variant="error">{error}</Alert>}
            <div className="flex gap-3">
              <PrimaryButton disabled={loading} className="py-2.5">
                {loading ? 'Sending…' : 'Send code'}
              </PrimaryButton>
              <LinkButton
                onClick={() => {
                  setSmsFlow(null);
                  setError(null);
                }}
              >
                Cancel
              </LinkButton>
            </div>
          </form>
        )}

      {!reauthAction &&
        !twoFactorMethod &&
        !totpSetup &&
        !twoFactorPending &&
        smsFlow === 'code' && (
          <form className="space-y-4" onSubmit={handleVerifySms}>
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
              onChange={(event) => setSmsCode(event.target.value)}
              required
            />
            {error && <Alert variant="error">{error}</Alert>}
            <PrimaryButton disabled={loading} className="py-2.5">
              {loading ? 'Verifying…' : 'Verify'}
            </PrimaryButton>
          </form>
        )}

      {/* State A — 2FA not enabled */}
      {!reauthAction &&
        !twoFactorMethod &&
        !totpSetup &&
        !twoFactorPending &&
        !smsFlow && (
          <div className="space-y-3">
            <p className="text-[var(--text-muted)] text-sm">
              Add a second layer of security to your account.
            </p>
            {error && <Alert variant="error">{error}</Alert>}
            <div className="flex flex-col gap-2">
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
                <span className="px-2 py-0.5 bg-blue-100 [[data-mode='dark']_&]:bg-blue-950/20 border border-blue-300 [[data-mode='dark']_&]:border-blue-800/40 text-blue-700 [[data-mode='dark']_&]:text-blue-400 text-xs rounded-full">
                  Recommended
                </span>
              </div>
              <PrimaryButton
                disabled={loading}
                className="py-2.5"
                onClick={handleStartSmsSetup}
              >
                <i
                  className="fa-solid fa-comment-sms text-xs"
                  aria-hidden="true"
                />
                Set up SMS
              </PrimaryButton>
            </div>
          </div>
        )}
    </div>
  );
}
