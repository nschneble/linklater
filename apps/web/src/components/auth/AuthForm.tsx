import ForgotPasswordView from './ForgotPasswordView';
import LoginRegisterView from './LoginRegisterView';
import MfaView from './MfaView';
import PendingNoticeAnnouncer from '../common/PendingNoticeAnnouncer';
import { useAuthForm } from './useAuthForm';
import { useDocumentTitle } from '../../lib/hooks/useDocumentTitle';
import type { MfaChallenge, Mode } from './useAuthForm';

/**
 * An MFA challenge outranks the mode because its view renders on top of
 * the login flow, and the title must name what is on screen (WCAG 2.4.2).
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
 * Top-level authentication form: login, register, forgot-password and the
 * MFA challenge, chosen by route.
 *
 * The sr-only live region is the announcement channel for an error that
 * arrived on the URL, which is how a refused OAuth callback lands here.
 * The visible Alert paints the same text with its own live semantics off,
 * so exactly one region announces it; submit errors take the opposite
 * split.
 */
export default function AuthForm() {
  const {
    announceError,
    email,
    emailReference,
    error,
    errorAnnouncement,
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
        announceError={announceError}
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
      <span
        className="sr-only"
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        data-testid="auth-error-announcement"
      >
        {errorAnnouncement}
      </span>
      <PendingNoticeAnnouncer
        notice={notice?.message ?? null}
        variant={notice?.variant ?? 'success'}
        onDismiss={() => setNotice(null)}
      />
    </>
  );
}
