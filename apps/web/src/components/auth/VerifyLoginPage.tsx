import LoadingScreen from '../common/LoadingScreen';
import MfaStep from './MfaStep';
import { revokeAllSessions, verifyMagicLink } from '../../lib/api';
import { setPendingNotice } from '../../lib/pendingNotice';
import { useAuth } from '../../auth/AuthContext';
import { useDocumentTitle } from '../../lib/hooks/useDocumentTitle';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import type { MfaChallenge } from './useAuthForm';

interface PendingMfa {
  mfaMethod: MfaChallenge;
  mfaToken: string;
}

/**
 * The `/verify-login?token=…` route. A fresh login stores the tokens,
 * the same account keeps its session, and another account is swapped
 * in. Failures return to /login with an error notice.
 */
export default function VerifyLoginPage() {
  useDocumentTitle('Linklater – Verifying sign in');
  const [searchParameters] = useSearchParams();
  const navigate = useNavigate();
  const { loginWithToken, user } = useAuth();
  // mirror user so post-await reads skip the stale closure
  const userReference = useRef(user);
  useEffect(() => {
    userReference.current = user;
  }, [user]);
  const [pendingMfa, setPendingMfa] = useState<PendingMfa | null>(null);
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
        // MFA accounts must still clear the OTP challenge
        if ('mfaToken' in result) {
          setPendingMfa({
            mfaMethod: result.mfaMethod,
            mfaToken: result.mfaToken,
          });
          return;
        }

        const currentUser = userReference.current;
        const isSameAccount =
          currentUser !== null && currentUser.userId === result.userId;
        const isAccountSwitch =
          currentUser !== null && currentUser.userId !== result.userId;

        if (isSameAccount) {
          // same account: keep the session, discard the fresh tokens
          setPendingNotice('already-logged-in');
          navigate('/unread', { replace: true });
          return;
        }

        if (isAccountSwitch) {
          // revoke first so user never flips null (no redirect race)
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

  if (pendingMfa) {
    return (
      <MfaStep
        branded
        mfaMethod={pendingMfa.mfaMethod}
        mfaToken={pendingMfa.mfaToken}
      />
    );
  }

  // bare spinner: no card chrome to flash before the redirect
  return <LoadingScreen statusText="Verifying your login link…" />;
}
