import { useAuth } from '../auth/AuthContext';
import { useState, type FormEvent } from 'react';

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
      setError(message);
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
        <button
          type="button"
          className={`flex-1 py-2 text-sm rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
            mode === 'login'
              ? 'bg-[var(--text)] text-[var(--bg)] font-semibold'
              : 'text-[var(--text-muted)]'
          }`}
          onClick={() => changeModes('login')}
          role="tab"
          aria-selected={mode === 'login'}
        >
          Log in
        </button>
        <button
          type="button"
          className={`flex-1 py-2 text-sm rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
            mode === 'register'
              ? 'bg-[var(--text)] text-[var(--bg)] font-semibold'
              : 'text-[var(--text-muted)]'
          }`}
          onClick={() => changeModes('register')}
          role="tab"
          aria-selected={mode === 'register'}
        >
          Sign up
        </button>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="block text-[var(--text-muted)] text-sm font-medium">
          Email
          <input
            type="email"
            autoComplete="email"
            className="block w-full mt-1 px-3 py-2 bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text)] text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
            onChange={(event) => setEmail(event.target.value)}
            value={email}
            required
          />
        </label>

        <label className="block text-[var(--text-muted)] text-sm font-medium">
          Password
          <input
            type="password"
            autoComplete={
              mode === 'login' ? 'current-password' : 'new-password'
            }
            className="block w-full mt-1 px-3 py-2 bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text)] text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
            onChange={(event) => setPassword(event.target.value)}
            value={password}
            required
          />
        </label>

        {error && (
          <p
            className="px-3 py-2 bg-rose-950/40 border border-rose-800 text-sm text-rose-400 rounded-lg"
            role="alert"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          className="inline-flex items-center justify-center gap-2 w-full py-2.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-fg)] text-sm font-semibold rounded-lg shadow-md disabled:opacity-60 disabled:cursor-wait transition"
          disabled={loading}
        >
          <i className="fa-solid fa-right-to-bracket text-xs" />
          {loading
            ? 'Working…'
            : mode === 'login'
              ? 'Log in'
              : 'Create account'}
        </button>
      </form>
    </div>
  );
}
