import { FormEvent, useState } from 'react';
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
    <div className="max-w-md w-full mx-auto bg-slate-900/80 border border-slate-700 rounded-2xl shadow-xl p-8">
      <h1 className="text-3xl font-bold text-slate-50 mb-2 text-center">
        Linklater
      </h1>
      <p className="text-slate-400 text-center mb-6">
        Save links now, read them later.
      </p>

      <div className="flex mb-6 rounded-full bg-slate-800 p-1">
        <button
          type="button"
          onClick={() => changeModes('login')}
          className={`flex-1 py-2 text-sm rounded-full transition ${
            mode === 'login'
              ? 'bg-slate-100 text-slate-900 font-semibold'
              : 'text-slate-400'
          }`}
        >
          Log in
        </button>
        <button
          type="button"
          onClick={() => changeModes('register')}
          className={`flex-1 py-2 text-sm rounded-full transition ${
            mode === 'register'
              ? 'bg-slate-100 text-slate-900 font-semibold'
              : 'text-slate-400'
          }`}
        >
          Sign up
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block text-sm font-medium text-slate-200">
          Email
          <input
            type="email"
            autoComplete="email"
            className="mt-1 block w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>

        <label className="block text-sm font-medium text-slate-200">
          Password
          <input
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            className="mt-1 block w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        {error && (
          <p className="text-sm text-rose-400 bg-rose-950/40 border border-rose-800 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-400 text-slate-950 font-semibold py-2.5 text-sm shadow-md shadow-emerald-500/30 hover:bg-emerald-300 disabled:opacity-60 disabled:cursor-wait transition"
        >
          <i className="fa-solid fa-right-to-bracket text-xs" />
          {loading ? 'Working…' : mode === 'login' ? 'Log in' : 'Create account'}
        </button>
      </form>

      <p className="mt-4 text-xs text-center text-slate-500">
        This is a demo app for a take-home assignment. Please don&apos;t use a real
        password 🙃
      </p>
    </div>
  );
}
