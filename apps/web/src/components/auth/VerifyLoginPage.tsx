import { useAuth } from '../../auth/AuthContext';
import { verifyMagicLink, verifyOtp } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import { useDocumentTitle } from '../../lib/hooks/useDocumentTitle';
import AuthErrorPanel from './AuthErrorPanel';
import MfaView from './MfaView';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

type Status = 'verifying' | 'success' | 'error' | 'mfa';
type MfaChallenge = 'totp' | 'recovery';

/**
 * Handles the `/verify-login?token=…` route for magic-link login.
 *
 * Reads the `?token=` query parameter, calls `POST /auth/verify-magic-link`,
 * stores the returned JWT via `loginWithToken`, and navigates to `/unread`.
 */
export default function VerifyLoginPage() {
  useDocumentTitle('Verifying sign in — Linklater');
  const [searchParameters] = useSearchParams();
  const navigate = useNavigate();
  const { loginWithToken, refreshUser } = useAuth();
  const [status, setStatus] = useState<Status>('verifying');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [mfaChallenge, setMfaChallenge] = useState<MfaChallenge>('totp');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaLoading, setMfaLoading] = useState(false);
  const errorReference = useRef<HTMLParagraphElement>(null);
  const mfaInputReference = useRef<HTMLInputElement>(null);
  const hasVerified = useRef(false);

  useEffect(() => {
    if (hasVerified.current) return;
    hasVerified.current = true;

    const token = searchParameters.get('token');
    if (!token) {
      setStatus('error');
      setErrorMessage('No login token found in the link.');
      return;
    }

    verifyMagicLink(token)
      .then(async (result) => {
        // MFA-enabled accounts that authenticate via a magic link still need
        // to clear the OTP challenge before a session is issued — mirror the
        // password login flow and surface the same MfaView.
        if ('mfaToken' in result) {
          setMfaToken(result.mfaToken);
          setMfaChallenge(result.mfaMethod);
          setStatus('mfa');
          return;
        }
        await loginWithToken(result.accessToken, result.refreshToken);
        setStatus('success');
        navigate('/unread', { replace: true });
      })
      .catch((error: unknown) => {
        setStatus('error');
        setErrorMessage(getErrorMessage(error, 'Login failed.'));
      });
  }, [loginWithToken, navigate, searchParameters]);

  // focus the MfaView error when it appears. the ref is only attached while
  // the mfa step is mounted, so this is a no-op for the full-page error.
  useEffect(() => {
    if (errorMessage) {
      errorReference.current?.focus();
    }
  }, [errorMessage]);

  const handleVerifyOtp = async (formEvent: FormEvent) => {
    formEvent.preventDefault();
    if (!mfaToken) return;
    setErrorMessage(null);
    setMfaLoading(true);
    try {
      await verifyOtp(mfaToken, mfaCode, mfaChallenge);
      await refreshUser();
      setMfaCode('');
      navigate('/unread', { replace: true });
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error, 'Invalid code'));
      setMfaCode('');
    } finally {
      setMfaLoading(false);
    }
  };

  if (status === 'mfa') {
    return (
      <MfaView
        error={errorMessage}
        errorReference={errorReference}
        loading={mfaLoading}
        mfaChallenge={mfaChallenge}
        mfaCode={mfaCode}
        mfaInputReference={mfaInputReference}
        onMfaCodeChange={setMfaCode}
        onSubmit={handleVerifyOtp}
        onSwitchToRecovery={() => {
          setMfaChallenge('recovery');
          setMfaCode('');
          setErrorMessage(null);
        }}
        onSwitchToTotp={() => {
          setMfaChallenge('totp');
          setMfaCode('');
          setErrorMessage(null);
        }}
      />
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen px-4 bg-gradient-to-b from-[var(--page-gradient-from)] via-[var(--page-gradient-via)] to-[var(--page-gradient-to)]">
      <div className="w-full max-w-md mx-auto p-8 bg-[var(--mount-bg)] border-shadow rounded-2xl text-center select-none">
        <h1 className="mb-4 text-[var(--mount-text)] text-2xl font-bold">
          Logging in…
        </h1>

        {status === 'verifying' && (
          <p
            role="status"
            aria-live="polite"
            className="text-[var(--mount-alt-text)] animate-pulse"
          >
            Verifying your login link…
          </p>
        )}

        {status === 'error' && (
          <AuthErrorPanel
            errorMessage={errorMessage}
            explanation="This login link may have expired or already been used. Request a new one from the login page."
            onBackToLogin={() => navigate('/login')}
          />
        )}
      </div>
    </div>
  );
}
