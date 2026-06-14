import ForgotPasswordView from './ForgotPasswordView';
import LoginRegisterView from './LoginRegisterView';
import MfaView from './MfaView';
import PendingNoticeAnnouncer from '../common/PendingNoticeAnnouncer';
import { useAuthForm } from './useAuthForm';

/**
 * Top-level authentication form. Drives login, register, forgot-password, and
 * MFA challenge flows from a single component by deriving `mode` from the
 * current URL pathname (`/login`, `/signup`, `/forgot-password`).
 *
 * After a successful credential check, if the server returns a `mfaToken`
 * the form transitions to an `MfaView` where the user enters their TOTP or
 * recovery code. The `mfaToken` is a short-lived server-issued token that
 * identifies the pending MFA session — it is not a full JWT.
 */
export default function AuthForm() {
  const {
    email,
    emailReference,
    error,
    errorReference,
    forgotPasswordSent,
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

  let view;
  if (mode === 'forgot-password') {
    view = (
      <ForgotPasswordView
        email={email}
        emailReference={emailReference}
        error={error}
        errorReference={errorReference}
        forgotPasswordSent={forgotPasswordSent}
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
        notice={notice}
        onDismiss={() => setNotice(null)}
      />
    </>
  );
}
