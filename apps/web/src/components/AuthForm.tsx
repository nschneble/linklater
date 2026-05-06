import { forgotPassword as apiForgotPassword } from '../lib/api';
import { getErrorMessage } from '../lib/errors';
import { useAuth } from '../auth/AuthContext';
import { useState, useRef, useEffect, type FormEvent } from 'react';
import Alert from './ui/Alert';
import FormInput from './ui/FormInput';
import LinkButton from './ui/LinkButton';
import PrimaryButton from './ui/PrimaryButton';
import TabButton from './ui/TabButton';

type Mode = 'login' | 'register' | 'forgot-password';

export default function AuthForm() {
  const { login, register } = useAuth();

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
