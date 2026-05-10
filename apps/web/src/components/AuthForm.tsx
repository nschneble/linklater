import { forgotPassword as apiForgotPassword } from '../lib/api';
import { getErrorMessage } from '../lib/errors';
import { useAuth } from '../auth/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { useState, useRef, useEffect, type FormEvent } from 'react';
import Alert from './ui/Alert';
import FormInput from './ui/FormInput';
import LinkButton from './ui/LinkButton';
import PrimaryButton from './ui/PrimaryButton';
import TabButton from './ui/TabButton';

const googleSsoEnabled = import.meta.env.VITE_GOOGLE_SSO_ENABLED === 'true';
const appleSsoEnabled = import.meta.env.VITE_APPLE_SSO_ENABLED === 'true';

/** The three sub-views rendered by `AuthForm`. */
type Mode = 'login' | 'register' | 'forgot-password';

/**
 * Authentication form shown to unauthenticated users at the root route.
 *
 * Has three modes controlled by a local `mode` state:
 * - `'login'`: email + password, submits to `POST /auth/login`.
 * - `'register'`: same fields, submits to `POST /auth/register` then logs in.
 * - `'forgot-password'`: email only, submits to `POST /auth/forgot-password`.
 *
 * Switching modes resets password, error, and loading state. The email input
 * is auto-focused whenever the mode changes.
 *
 * After a successful forgot-password submission the form switches to a
 * confirmation state showing an `Alert` instead of the form fields.
 */
export default function AuthForm() {
  const { login, register } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const emailReference = useRef<HTMLInputElement>(null);

  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<Mode>('login');
  const [password, setPassword] = useState('');
  const [forgotPasswordSent, setForgotPasswordSent] = useState(false);

  useEffect(() => {
    emailReference.current?.focus();
  }, [mode]);

  const handleSubmit = async (formEvent: FormEvent) => {
    formEvent.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        await login(email, password);
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
    } catch (error: unknown) {
      const message = getErrorMessage(error, 'Something went dreadfully wrong');
      setError(message.charAt(0).toUpperCase() + message.slice(1));
    } finally {
      setLoading(false);
    }
  };

  const handleModeChange = (newMode: Mode) => {
    setMode(newMode);
    setPassword('');
    setError(null);
    setLoading(false);
    setForgotPasswordSent(false);
  };

  if (mode === 'forgot-password') {
    return (
      <div className="w-full max-w-md mx-auto p-8 bg-[var(--bg-surface)] border-shadow rounded-2xl select-none">
        <h1 className="mb-2 text-[var(--text)] text-center text-2xl font-bold [text-wrap:balance]">
          You forgot?
        </h1>
        <p className="mb-6 text-[var(--text-muted)] text-center text-sm">
          Silly goose. Fear not, we'll get you sorted.
        </p>

        {forgotPasswordSent ? (
          <div className="text-center space-y-4">
            <Alert variant="success">
              Check your email for a reset link. It expires in 1 hour.
            </Alert>
            <LinkButton onClick={() => handleModeChange('login')}>
              Back to login
            </LinkButton>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <label
              htmlFor="forgot-email"
              className="block mb-0 text-[var(--text-muted)] text-sm font-medium"
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
              {loading ? 'Sending…' : 'Send password reset link'}
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

  return (
    <div className="w-full max-w-md mx-auto p-8 bg-[var(--bg-surface)] border-shadow rounded-2xl select-none">
      <h1 className="mb-2 text-[var(--text)] text-center text-3xl font-bold [text-wrap:balance]">
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
          htmlFor="auth-email"
          className="block mb-0 text-[var(--text-muted)] text-sm font-medium"
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
          htmlFor="auth-password"
          className="block mb-0 text-[var(--text-muted)] text-sm font-medium"
        >
          Password
        </label>
        <FormInput
          id="auth-password"
          type="password"
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          onChange={(event) => setPassword(event.target.value)}
          value={password}
          required
        />

        {error && <Alert variant="error">{error}</Alert>}

        <PrimaryButton disabled={loading} className="w-full py-2.5">
          <i
            className="fa-solid fa-right-to-bracket text-xs"
            aria-hidden="true"
          />
          {loading
            ? 'Working…'
            : mode === 'login'
              ? 'Log in'
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
              <a
                href={`${import.meta.env.VITE_API_BASE_URL}/auth/google`}
                className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text)] text-sm font-medium rounded-lg transition hover:opacity-80"
                aria-label="Continue with Google"
              >
                <svg
                  aria-hidden="true"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                Continue with Google
              </a>
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

      <p
        className={`mt-4 text-center transition-opacity duration-200 ${mode === 'login' ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      >
        <LinkButton onClick={() => handleModeChange('forgot-password')}>
          I literally have no idea what my password is
        </LinkButton>
      </p>
    </div>
  );
}
