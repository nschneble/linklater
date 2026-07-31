import { setPendingNotice } from '../../lib/pendingNotice';
import { useAuth } from '../../auth/AuthContext';
import { revokeAllSessions, verifyMagicLink, verifyOtp } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import { useDocumentTitle } from '../../lib/hooks/useDocumentTitle';
import MfaView from './MfaView';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import type { FormEvent } from 'react';

type MfaChallenge = 'totp' | 'recovery';

/**
 * Handles the `/verify-login?token=…` route for magic-link login.
 *
 * Reads the `?token=` query parameter, calls `POST /auth/verify-magic-link`,
 * and routes one of three ways based on the relationship between the
 * current session and the user the magic link belongs to:
 *
 *   1. No prior session → standard login: store the returned tokens via
 *      `loginWithToken`, navigate `/unread`, no toast (the destination is
 *      the confirmation that auth succeeded).
 *   2. Already signed in as the same user → keep the existing session,
 *      discard the returned tokens, queue `already-logged-in` toast,
 *      navigate `/unread`. The server-side magic-link token is still
 *      single-use (it was just consumed by the verify call), but we
 *      don't disturb the current JWT – open tabs stay valid.
 *   3. Signed in as a different user (cross-account click) → call
 *      `revokeAllSessions()` first (uses the OLD user's bearer to DELETE
 *      /auth/sessions), then `loginWithToken` with the new tokens,
 *      queue `account-switched` warn toast, navigate `/unread`. The
 *      logout-then-login sequence is bypassed at the React-state level
 *      (we never flip `user` to `null` mid-flow) so the catch-all
 *      auth-redirect cannot race in and bounce us to `/login`.
 *
 * Failures redirect to /login with an error-variant pending notice; the
 * AuthForm surfaces it as an assertive toast. /login is also where the
 * user immediately retries (request a new link), so the toast copy stays
 * short (WCAG 3.3.3 – recovery destination is the page the user lands
 * on).
 *
 * MFA-enabled accounts authenticated via magic link still need to clear
 * the OTP challenge; that branch mounts `MfaView` and is unchanged.
 */
export default function VerifyLoginPage() {
  useDocumentTitle('Linklater – Verifying sign in');
  const [searchParameters] = useSearchParams();
  const navigate = useNavigate();
  const { loginWithToken, refreshUser, user } = useAuth();
  // mirror user into a ref so post-await reads the effect-time value, not a stale closure
  const userReference = useRef(user);
  useEffect(() => {
    userReference.current = user;
  }, [user]);
  const [isInMfa, setIsInMfa] = useState(false);
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [mfaChallenge, setMfaChallenge] = useState<MfaChallenge>('totp');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaLoading, setMfaLoading] = useState(false);
  // mfaError is only for OTP failures; verify-link failures redirect to /login
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
        // MFA accounts via magic link still must clear the OTP challenge first
        if ('mfaToken' in result) {
          setMfaToken(result.mfaToken);
          setMfaChallenge(result.mfaMethod);
          setIsInMfa(true);
          return;
        }

        const currentUser = userReference.current;
        const isSameAccount =
          currentUser !== null && currentUser.userId === result.userId;
        const isAccountSwitch =
          currentUser !== null && currentUser.userId !== result.userId;

        if (isSameAccount) {
          // same account: keep the session, discard fresh tokens (no JWT rotation)
          setPendingNotice('already-logged-in');
          navigate('/unread', { replace: true });
          return;
        }

        if (isAccountSwitch) {
          // revoke old sessions before swapping tokens so user never flips null (no redirect race)
          await revokeAllSessions();
          await loginWithToken(result.accessToken, result.refreshToken);
          setPendingNotice('account-switched');
          navigate('/unread', { replace: true });
          return;
        }

        // fresh login: no toast, the destination confirms success
        await loginWithToken(result.accessToken, result.refreshToken);
        navigate('/unread', { replace: true });
      })
      .catch((error: unknown) => {
        void error;
        setPendingNotice('login-link-invalid');
        navigate('/login', { replace: true });
      });
  }, [loginWithToken, navigate, searchParameters]);

  // focus the MfaView error; the ref only attaches during the MFA step
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

  // bare spinner, no card chrome that would flash before the redirect fires
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
