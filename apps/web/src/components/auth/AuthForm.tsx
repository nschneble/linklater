import Alert from '../common/Alert';
import FormInput from '../common/FormInput';
import IconButton from '../common/IconButton';
import LinkButton from '../common/LinkButton';
import PrimaryButton from '../common/PrimaryButton';
import TabButton from '../common/TabButton';
import {
  forgotPassword as apiForgotPassword,
  requestMagicLink,
  verifyOtp,
} from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import { useAuth } from '../../auth/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState, type FormEvent } from 'react';

const googleSsoEnabled = import.meta.env.VITE_GOOGLE_SSO_ENABLED === 'true';
const appleSsoEnabled = import.meta.env.VITE_APPLE_SSO_ENABLED === 'true';

/** The sub-views rendered by `AuthForm`. */
type Mode = 'login' | 'register' | 'forgot-password';

/** The MFA challenge method currently being shown to the user. */
type MfaChallenge = 'totp' | 'recovery';

/**
 * Authentication form rendered for `/login`, `/signup`, and
 * `/forgot-password` endpoints.
 *
 * Mode is derived from the current pathname:
 * - `/login`           → `'login'`
 *                        email + password, submits `POST /auth/login`
 * - `/signup`          → `'register'`
 *                        email + password, submits `POST /auth/register`
 * - `/forgot-password` → `'forgot-password'`
 *                        email, submits `POST /auth/forgot-password`
 *
 * Switching modes (via tab click or link) navigates to the corresponding
 * route, which resets password, error, and loading state. The email input
 * is auto-focused on mode change unless the email field already has text,
 * in which case the password input is focused.
 *
 * After a successful forgot-password submission the form switches to a
 * confirmation state showing an `Alert` instead of the form fields.
 */
export default function AuthForm() {
  const { login, refreshUser, register } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const emailReference = useRef<HTMLInputElement>(null);
  const mfaInputReference = useRef<HTMLInputElement>(null);
  const passwordReference = useRef<HTMLInputElement>(null);

  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState('');
  const [forgotPasswordSent, setForgotPasswordSent] = useState(false);

  const [magicLinkSent, setMagicLinkSent] = useState(false);

  // MFA state — held only in component memory, never persisted
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [mfaChallenge, setMfaChallenge] = useState<MfaChallenge | null>(null);
  const [mfaCode, setMfaCode] = useState('');

  const mode: Mode =
    location.pathname === '/signup'
      ? 'register'
      : location.pathname === '/forgot-password'
        ? 'forgot-password'
        : 'login';

  useEffect(() => {
    setPassword('');
    setError(null);
    setLoading(false);
    setForgotPasswordSent(false);
    setMagicLinkSent(false);

    const emailInputValue = emailReference.current?.value ?? '';

    if (mode !== 'forgot-password' && emailInputValue.length > 0) {
      passwordReference.current?.focus();
      return;
    }

    emailReference.current?.focus();
  }, [mode]);

  useEffect(() => {
    if (mfaChallenge) {
      mfaInputReference.current?.focus();
    }
  }, [mfaChallenge]);

  const handleSubmit = async (formEvent: FormEvent) => {
    formEvent.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'login' && password.length === 0) {
        await requestMagicLink(email);
        setMagicLinkSent(true);
        return;
      }

      if (mode === 'login') {
        const result = await login(email, password);
        if (result && 'mfaToken' in result) {
          setMfaToken(result.mfaToken);
          setMfaChallenge(result.mfaMethod);
          return;
        }
      } else if (mode === 'register') {
        await register(email, password);
      } else {
        await apiForgotPassword(email);
        setForgotPasswordSent(true);
      }

      if (mode !== 'forgot-password') {
        const destination =
          (location.state as { from?: string })?.from ?? '/unread';
        navigate(destination, { replace: true });
      }
    } catch (caught: unknown) {
      const message = getErrorMessage(
        caught,
        'Something went dreadfully wrong',
      );
      setError(message.charAt(0).toUpperCase() + message.slice(1));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (formEvent: FormEvent) => {
    formEvent.preventDefault();
    if (!mfaToken || !mfaChallenge) return;
    setError(null);
    setLoading(true);
    try {
      await verifyOtp(mfaToken, mfaCode, mfaChallenge);
      await refreshUser();
      const destination =
        (location.state as { from?: string })?.from ?? '/unread';
      navigate(destination, { replace: true });
    } catch (caught: unknown) {
      const message = getErrorMessage(caught, 'Invalid code');
      setError(message.charAt(0).toUpperCase() + message.slice(1));
    } finally {
      setLoading(false);
    }
  };

  const handleModeChange = (newMode: Mode) => {
    const from = (location.state as { from?: string })?.from;
    const path =
      newMode === 'register'
        ? '/signup'
        : newMode === 'forgot-password'
          ? '/forgot-password'
          : '/login';
    navigate(path, { state: { from }, replace: true });
  };

  if (mode === 'forgot-password') {
    return (
      <div className="w-full max-w-md mx-auto p-8 bg-[var(--bg-surface)] border-shadow rounded-2xl select-none">
        <h1 className="mb-2 text-[var(--text)] text-center text-2xl font-bold text-balance">
          You forgot?
        </h1>
        <p className="mb-6 text-[var(--text-muted)] text-center text-sm">
          Silly goose. We'll send you a reset link! Unless you don't have an
          account. Then this isn't gonna do much.
        </p>

        {forgotPasswordSent ? (
          <div className="text-center space-y-4">
            <Alert variant="success">Check your email for a reset link!</Alert>
            <LinkButton onClick={() => handleModeChange('login')}>
              Back to login
            </LinkButton>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <label
              className="block mb-0 text-[var(--text-muted)] text-sm font-medium"
              htmlFor="forgot-email"
            >
              Email
            </label>
            <FormInput
              id="forgot-email"
              ref={emailReference}
              type="email"
              autoComplete="email"
              onChange={(event) => setEmail(event.target.value)}
              value={email}
              required
            />

            {error && <Alert variant="error">{error}</Alert>}

            <PrimaryButton disabled={loading} className="w-full py-2.5">
              <i className="fa-solid fa-envelope text-xs" aria-hidden="true" />
              Send password reset link
            </PrimaryButton>

            <p className="text-center">
              <LinkButton onClick={() => handleModeChange('login')}>
                Back to login
              </LinkButton>
            </p>
          </form>
        )}
      </div>
    );
  }

  if (mfaChallenge) {
    const isRecovery = mfaChallenge === 'recovery';

    return (
      <div className="w-full max-w-md mx-auto p-8 bg-[var(--bg-surface)] border-shadow rounded-2xl select-none">
        <h1 className="mb-2 text-[var(--text)] text-center text-2xl font-bold text-balance">
          {isRecovery ? 'Enter a recovery code' : 'Two-factor authentication'}
        </h1>
        <p className="mb-6 text-[var(--text-muted)] text-center text-sm">
          {isRecovery
            ? 'Enter one of your saved recovery codes.'
            : 'Enter the code from your authenticator app.'}
        </p>

        <form className="space-y-4" onSubmit={handleVerifyOtp}>
          <label
            className="block mb-0 text-[var(--text-muted)] text-sm font-medium"
            htmlFor={isRecovery ? 'mfa-recovery-code' : 'mfa-totp-code'}
          >
            {isRecovery ? 'Recovery code' : 'Authenticator code'}
          </label>
          <FormInput
            id={isRecovery ? 'mfa-recovery-code' : 'mfa-totp-code'}
            ref={mfaInputReference}
            type="text"
            inputMode={isRecovery ? 'text' : 'numeric'}
            autoComplete={isRecovery ? 'off' : 'one-time-code'}
            maxLength={isRecovery ? undefined : 6}
            onChange={(event) => setMfaCode(event.target.value)}
            value={mfaCode}
            required
          />

          {error && <Alert variant="error">{error}</Alert>}

          <PrimaryButton disabled={loading} className="w-full py-2.5">
            {loading ? 'Verifying…' : 'Verify'}
          </PrimaryButton>
        </form>

        <div className="mt-4 flex flex-col items-center gap-2 text-center">
          {!isRecovery && (
            <LinkButton
              onClick={() => {
                setMfaChallenge('recovery');
                setMfaCode('');
                setError(null);
              }}
            >
              Use a recovery code
            </LinkButton>
          )}
          {isRecovery && (
            <LinkButton
              onClick={() => {
                setMfaChallenge('totp');
                setMfaCode('');
                setError(null);
              }}
            >
              Use a different method
            </LinkButton>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto p-8 bg-[var(--bg-surface)] border-shadow rounded-2xl select-none">
      <h1 className="mb-2 text-[var(--text)] text-center text-3xl font-bold text-balance">
        Linklater
      </h1>
      <p className="mb-6 text-[var(--text-muted)] text-center">
        Save links now, read them later.
      </p>

      <div
        className="relative flex mb-[24.5px] p-1 bg-[var(--bg-elevated)] rounded-full"
        role="tablist"
        aria-label="Authentication mode"
      >
        <div
          aria-hidden="true"
          className="absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] bg-[var(--text)] rounded-full"
          style={{
            transition: 'transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1)',
            transform:
              mode === 'register' ? 'translateX(100%)' : 'translateX(0)',
          }}
        />
        <TabButton
          className="flex-1 py-2 text-sm"
          isActive={mode === 'login'}
          onClick={() => handleModeChange('login')}
        >
          Log in
        </TabButton>
        <TabButton
          className="flex-1 py-2 text-sm"
          isActive={mode === 'register'}
          onClick={() => handleModeChange('register')}
        >
          Sign up
        </TabButton>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <label
          className="block mb-0 text-[var(--text-muted)] text-sm font-medium"
          htmlFor="auth-email"
        >
          Email
        </label>
        <FormInput
          id="auth-email"
          ref={emailReference}
          type="email"
          autoComplete="email"
          onChange={(event) => setEmail(event.target.value)}
          value={email}
          required
        />

        <label
          className="block mb-0 text-[var(--text-muted)] text-sm font-medium"
          htmlFor="auth-password"
        >
          Password
        </label>
        <FormInput
          id="auth-password"
          ref={passwordReference}
          type="password"
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          onChange={(event) => setPassword(event.target.value)}
          placeholder={mode === 'login' ? 'Leave blank to use magic link' : ''}
          value={password}
          required={mode === 'register'}
        />

        {error && <Alert variant="error">{error}</Alert>}
        {magicLinkSent && (
          <Alert variant="success">Check your email for a login link!</Alert>
        )}

        <PrimaryButton disabled={loading} className="w-full py-2.5">
          <i
            className={`fa-solid ${mode === 'login' && password.length === 0 ? 'fa-wand-magic-sparkles' : 'fa-right-to-bracket'} text-xs`}
            aria-hidden="true"
          />
          {loading
            ? 'Working…'
            : mode === 'login'
              ? password.length === 0
                ? 'Log in with magic link'
                : 'Log in'
              : 'Create account'}
        </PrimaryButton>
      </form>

      {(googleSsoEnabled || appleSsoEnabled) && (
        <>
          <div className="relative my-5">
            <div
              className="absolute inset-0 flex items-center"
              aria-hidden="true"
            >
              <div className="w-full border-t border-[var(--border)]" />
            </div>
            <div className="relative flex justify-center">
              <span className="px-3 bg-[var(--bg-surface)] text-[var(--text-muted)] text-xs">
                or continue with
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {googleSsoEnabled && (
              <IconButton
                variant="elevated"
                title="Continue with Google"
                className="w-full py-2.5 rounded-lg"
                onClick={() => {
                  window.location.href = `${import.meta.env.VITE_API_BASE_URL}/auth/google`;
                }}
              >
                <i
                  className="fa-brands fa-google text-[0.7rem]"
                  aria-hidden="true"
                />
                Continue with Google
              </IconButton>
            )}

            {appleSsoEnabled && (
              <a
                href={`${import.meta.env.VITE_API_BASE_URL}/auth/apple`}
                className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text)] text-sm font-medium rounded-lg transition hover:opacity-80"
                aria-label="Continue with Apple"
              >
                <svg
                  aria-hidden="true"
                  width="16"
                  height="16"
                  viewBox="0 0 814 1000"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="currentColor"
                >
                  <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-57.8-155.5-127.4C46 405.1 45 281.9 77.2 207.3c21.6-49.9 68.3-82.9 120.4-82.9 46.1 0 91.1 25 100.2 51.3 8.8 25.2 9.8 57.7 9.8 75.5 0 47.8-4.3 91.1-12.2 127.4 54.7-16.5 88.4-80.9 88.4-150.5 0-73.3-21.3-130.6-63.7-162.8C288.8 40.5 241.2 15 185.1 15 89.8 15 45 72.9 45 107.1 0 107.1 0 113 0 118.8c0 73.2 46.5 204.4 99.4 253.2 5.8 5.5 13.2 10.5 21.6 14.9C79.5 436.9 46 534.5 46 563.8 46 658 94 788.1 167.6 852c61.6 53 125.5 85.9 196.2 85.9 91.9 0 124.2-47 209.4-47 85.5 0 126.7 47 212.8 47 105 0 185.9-93.5 244.3-220.6 32.4-70.3 46.5-100.3 46.5-100.3z" />
                </svg>
                Continue with Apple
              </a>
            )}
          </div>
        </>
      )}

      <div
        className={`mt-4 flex flex-col items-center gap-2 text-center transition-opacity duration-200 ${mode === 'login' ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      >
        <LinkButton onClick={() => handleModeChange('forgot-password')}>
          I literally have no idea what my password is
        </LinkButton>
      </div>
    </div>
  );
}
