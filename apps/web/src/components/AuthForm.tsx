import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext';

type Mode = 'login' | 'register';

export default function AuthForm() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(email, password);
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? JSON.parse(err.message).message
          : 'Something went dreafully wrong';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const changeModes = async (newMode: Mode) => {
    setMode(newMode);
    setError(null);
    setLoading(false);
  };

  return (
    <div className="max-w-md w-full mx-auto bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl shadow-xl p-8">
      <h1 className="text-3xl font-bold text-[var(--text)] mb-2 text-center">
        Linklater
      </h1>
      <p className="text-[var(--text-muted)] text-center mb-6">
        Save links now, read them later.
      </p>

      <div role="tablist" aria-label="Authentication mode" className="flex mb-6 rounded-full bg-[var(--bg-elevated)] p-1">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'login'}
          onClick={() => changeModes('login')}
          className={`flex-1 py-2 text-sm rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
            mode === 'login'
              ? 'bg-[var(--text)] text-[var(--bg)] font-semibold'
              : 'text-[var(--text-muted)]'
          }`}
        >
          Log in
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'register'}
          onClick={() => changeModes('register')}
          className={`flex-1 py-2 text-sm rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
            mode === 'register'
              ? 'bg-[var(--text)] text-[var(--bg)] font-semibold'
              : 'text-[var(--text-muted)]'
          }`}
        >
          Sign up
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block text-sm font-medium text-[var(--text-muted)]">
          Email
          <input
            type="email"
            autoComplete="email"
            className="mt-1 block w-full rounded-lg bg-[var(--bg-input)] border border-[var(--border)] px-3 py-2 text-[var(--text)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>

        <label className="block text-sm font-medium text-[var(--text-muted)]">
          Password
          <input
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            className="mt-1 block w-full rounded-lg bg-[var(--bg-input)] border border-[var(--border)] px-3 py-2 text-[var(--text)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        {error && (
          <p role="alert" className="text-sm text-rose-400 bg-rose-950/40 border border-rose-800 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--accent)] text-[var(--accent-fg)] font-semibold py-2.5 text-sm shadow-md hover:bg-[var(--accent-hover)] disabled:opacity-60 disabled:cursor-wait transition"
        >
          <i className="fa-solid fa-right-to-bracket text-xs" />
          {loading ? 'Working…' : mode === 'login' ? 'Log in' : 'Create account'}
        </button>
      </form>

      <p className="mt-4 text-xs text-center text-[var(--text-subtle)]">
        This is a demo app for a take-home assignment. Please don&apos;t use a real
        password 🙃
      </p>
    </div>
  );
}
