import { setPendingNotice } from '../../lib/pendingNotice';
import { useAuth } from '../../auth/AuthContext';
import { verifyMagicLink, verifyOtp } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import { useDocumentTitle } from '../../lib/hooks/useDocumentTitle';
import MfaView from './MfaView';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

type MfaChallenge = 'totp' | 'recovery';

/**
 * Handles the `/verify-login?token=…` route for magic-link login.
 *
 * Reads the `?token=` query parameter, calls `POST /auth/verify-magic-link`,
 * stores the returned JWT via `loginWithToken`, and navigates to `/unread`.
 *
 * Success has no toast — magic-link login is just login (equivalent to
 * typing a password), and the destination /unread page is itself the
 * confirmation that auth succeeded. Failures redirect to /login with an
 * error-variant pending notice; the AuthForm surfaces it as an assertive
 * toast. /login is also where the user immediately retries (request a new
 * link), so the toast copy stays short (WCAG 3.3.3 — recovery destination
 * is the page the user lands on).
 *
 * MFA-enabled accounts authenticated via magic link still need to clear
 * the OTP challenge; that branch mounts `MfaView` and is unchanged.
 */
export default function VerifyLoginPage() {
  useDocumentTitle('Verifying sign in — Linklater');
  const [searchParameters] = useSearchParams();
  const navigate = useNavigate();
  const { loginWithToken, refreshUser } = useAuth();
  const [isInMfa, setIsInMfa] = useState(false);
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [mfaChallenge, setMfaChallenge] = useState<MfaChallenge>('totp');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaLoading, setMfaLoading] = useState(false);
  // `mfaError` is scoped to OTP-submission failures only — the verify-link
  // failure paths redirect to /login and surface as toasts, never landing
  // in MfaView. Keeping the state name disambiguated avoids future drift.
  const [mfaError, setMfaError] = useState<string | null>(null);
  const mfaErrorReference = useRef<HTMLParagraphElement>(null);
  const mfaInputReference = useRef<HTMLInputElement>(null);
  const hasVerified = useRef(false);

  useEffect(() => {
    if (hasVerified.current) return;
    hasVerified.current = true;

    const token = searchParameters.get('token');
    if (!token) {
      setPendingNotice('login-link-invalid');
      navigate('/login', { replace: true });
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
          setIsInMfa(true);
          return;
        }
        await loginWithToken(result.accessToken, result.refreshToken);
        navigate('/unread', { replace: true });
      })
      .catch((error: unknown) => {
        void error;
        setPendingNotice('login-link-invalid');
        navigate('/login', { replace: true });
      });
  }, [loginWithToken, navigate, searchParameters]);

  // Focus the MfaView error when it appears. The ref is only attached while
  // the MFA step is mounted, so this is a no-op outside that branch.
  useEffect(() => {
    if (mfaError) {
      mfaErrorReference.current?.focus();
    }
  }, [mfaError]);

  const handleVerifyOtp = async (formEvent: FormEvent) => {
    formEvent.preventDefault();
    if (!mfaToken) return;
    setMfaError(null);
    setMfaLoading(true);
    try {
      await verifyOtp(mfaToken, mfaCode, mfaChallenge);
      await refreshUser();
      setMfaCode('');
      navigate('/unread', { replace: true });
    } catch (error: unknown) {
      setMfaError(getErrorMessage(error, 'Invalid code'));
      setMfaCode('');
    } finally {
      setMfaLoading(false);
    }
  };

  if (isInMfa) {
    return (
      <MfaView
        error={mfaError}
        errorReference={mfaErrorReference}
        loading={mfaLoading}
        mfaChallenge={mfaChallenge}
        mfaCode={mfaCode}
        mfaInputReference={mfaInputReference}
        onMfaCodeChange={setMfaCode}
        onSubmit={handleVerifyOtp}
        onSwitchToRecovery={() => {
          setMfaChallenge('recovery');
          setMfaCode('');
          setMfaError(null);
        }}
        onSwitchToTotp={() => {
          setMfaChallenge('totp');
          setMfaCode('');
          setMfaError(null);
        }}
      />
    );
  }

  // The verifying state is a bare centered spinner with an sr-only polite
  // status — the page is purely transient and any card chrome would flash
  // visibly for sub-second windows before the redirect fires, which reads
  // as "page loaded and immediately bounced." Failures surface as
  // error-variant toasts on /login rather than a full error card.
  return (
    <main className="flex items-center justify-center min-h-screen bg-[var(--base-bg)] text-[var(--base-alt-text)] select-none">
      <p role="status" aria-live="polite" className="sr-only">
        Verifying your login link…
      </p>
      <i
        className="fa-solid fa-arrows-rotate fa-spin text-4xl opacity-50"
        aria-hidden="true"
      />
    </main>
  );
}
