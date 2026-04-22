import { useAuth } from '../auth/AuthContext';
import { useState, type FormEvent } from 'react';
import Alert from './ui/Alert';
import FormInput from './ui/FormInput';
import PrimaryButton from './ui/PrimaryButton';
import TabButton from './ui/TabButton';

type Mode = 'login' | 'register';

export default function AuthForm() {
  const { login, register } = useAuth();

  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<Mode>('login');
  const [password, setPassword] = useState('');

  const handleSubmit = async (formEvent: FormEvent) => {
    formEvent.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(email, password);
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'Something went dreadfully wrong';
      setError(message.charAt(0).toUpperCase() + message.slice(1));
    } finally {
      setLoading(false);
    }
  };

  const changeModes = (newMode: Mode) => {
    setMode(newMode);
    setError(null);
    setLoading(false);
  };

  return (
    <div className="w-full max-w-md mx-auto p-8 bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl shadow-xl">
      <h1 className="mb-2 text-[var(--text)] text-center text-3xl font-bold">
        Linklater
      </h1>
      <p className="mb-6 text-[var(--text-muted)] text-center">
        Save links now, read them later.
      </p>

      <div
        className="flex mb-6 p-1 bg-[var(--bg-elevated)] rounded-full"
        role="tablist"
        aria-label="Authentication mode"
      >
        <TabButton
          className="flex-1 py-2 text-sm"
          isActive={mode === 'login'}
          onClick={() => changeModes('login')}
        >
          Log in
        </TabButton>
        <TabButton
          className="flex-1 py-2 text-sm"
          isActive={mode === 'register'}
          onClick={() => changeModes('register')}
        >
          Sign up
        </TabButton>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="block text-[var(--text-muted)] text-sm font-medium">
          Email
          <FormInput
            type="email"
            autoComplete="email"
            onChange={(event) => setEmail(event.target.value)}
            value={email}
            required
          />
        </label>

        <label className="block text-[var(--text-muted)] text-sm font-medium">
          Password
          <FormInput
            type="password"
            autoComplete={
              mode === 'login' ? 'current-password' : 'new-password'
            }
            onChange={(event) => setPassword(event.target.value)}
            value={password}
            required
          />
        </label>

        {error && <Alert variant="error">{error}</Alert>}

        <PrimaryButton disabled={loading} className="w-full py-2.5">
          <i className="fa-solid fa-right-to-bracket text-xs" />
          {loading
            ? 'Working…'
            : mode === 'login'
              ? 'Log in'
              : 'Create account'}
        </PrimaryButton>
      </form>
    </div>
  );
}
