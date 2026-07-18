import ForgotPasswordView from './ForgotPasswordView';
import LoginRegisterView from './LoginRegisterView';
import MfaView from './MfaView';
import PendingNoticeAnnouncer from '../common/PendingNoticeAnnouncer';
import { useAuthForm } from './useAuthForm';
import { useDocumentTitle } from '../../lib/hooks/useDocumentTitle';
import type { MfaChallenge, Mode } from './useAuthForm';

/**
 * The page title for each auth flow. An MFA challenge takes precedence over
 * `mode` because the MFA view renders on top of the login flow, matching the
 * render precedence below (WCAG 2.4.2 Page Titled). The "Linklater – X"
 * en-dash separator matches the app-wide title convention.
 */
function authDocumentTitle(
  mode: Mode,
  mfaChallenge: MfaChallenge | null,
): string {
  if (mfaChallenge) return "Linklater – Verify it's you";
  if (mode === 'forgot-password') return 'Linklater – Reset password';
  if (mode === 'register') return 'Linklater – Sign up';
  return 'Linklater – Log in';
}

/**
 * Top-level authentication form. Drives login, register, forgot-password, and
 * MFA challenge flows from a single component by deriving `mode` from the
 * current URL pathname (`/login`, `/signup`, `/forgot-password`).
 *
 * After a successful credential check, if the server returns a `mfaToken`
 * the form transitions to an `MfaView` where the user enters their TOTP or
 * recovery code. The `mfaToken` is a short-lived server-issued token that
 * identifies the pending MFA session – it is not a full JWT.
 */
export default function AuthForm() {
  const {
    email,
    emailReference,
    error,
    errorReference,
    forgotPasswordSentJustNow,
    handleModeChange,
    handleSubmit,
    handleVerifyOtp,
    loading,
    magicLinkSentJustNow,
    mfaChallenge,
    mfaCode,
    mfaInputReference,
    mode,
    notice,
    password,
    passwordReference,
    setEmail,
    setMfaChallenge,
    setMfaCode,
    setError,
    setNotice,
    setPassword,
  } = useAuthForm();

  useDocumentTitle(authDocumentTitle(mode, mfaChallenge));

  let view;
  if (mode === 'forgot-password') {
    view = (
      <ForgotPasswordView
        email={email}
        emailReference={emailReference}
        error={error}
        errorReference={errorReference}
        forgotPasswordSentJustNow={forgotPasswordSentJustNow}
        loading={loading}
        onBack={() => handleModeChange('login')}
        onEmailChange={setEmail}
        onSubmit={handleSubmit}
      />
    );
  } else if (mfaChallenge) {
    view = (
      <MfaView
        error={error}
        errorReference={errorReference}
        loading={loading}
        mfaChallenge={mfaChallenge}
        mfaCode={mfaCode}
        mfaInputReference={mfaInputReference}
        onMfaCodeChange={setMfaCode}
        onSubmit={handleVerifyOtp}
        onSwitchToRecovery={() => {
          setMfaChallenge('recovery');
          setMfaCode('');
          setError(null);
        }}
        onSwitchToTotp={() => {
          setMfaChallenge('totp');
          setMfaCode('');
          setError(null);
        }}
      />
    );
  } else {
    view = (
      <LoginRegisterView
        email={email}
        emailReference={emailReference}
        error={error}
        errorReference={errorReference}
        loading={loading}
        magicLinkSentJustNow={magicLinkSentJustNow}
        mode={mode}
        onEmailChange={setEmail}
        onForgotPassword={() => handleModeChange('forgot-password')}
        onModeChange={handleModeChange}
        onPasswordChange={setPassword}
        onSubmit={handleSubmit}
        password={password}
        passwordReference={passwordReference}
      />
    );
  }

  return (
    <>
      {view}
      <PendingNoticeAnnouncer
        notice={notice?.message ?? null}
        variant={notice?.variant ?? 'success'}
        onDismiss={() => setNotice(null)}
      />
    </>
  );
}
