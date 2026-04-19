import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext';
import { updateMe, deleteMe } from '../lib/api';

export default function SettingsView() {
  const { user, logout, updateEmail } = useAuth();
  const [email, setEmail] = useState(user?.email ?? '');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const payload: { email?: string; password?: string } = {};
      if (email && email !== user?.email) payload.email = email;
      if (password) payload.password = password;

      if (!payload.email && !payload.password) {
        setMessage('Nothing to update');
      } else {
        await updateMe(payload);
        if (payload.email) {
          updateEmail(payload.email);
        }
        setMessage('Settings updated');
      }
      setPassword('');
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to update settings';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteMe();
      logout();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to delete account';
      setError(message);
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSave} className="space-y-4 max-w-md">
        <h2 className="text-xl font-semibold text-[var(--text)]">
          Account settings
        </h2>

        <label className="block text-xs font-medium text-[var(--text-muted)]">
          Email
          <input
            type="email"
            className="mt-1 block w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm bg-[var(--bg-input)] text-[var(--text)] placeholder:text-[var(--text-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>

        <label className="block text-xs font-medium text-[var(--text-muted)]">
          New password
          <input
            type="password"
            placeholder="Leave blank to keep current password"
            className="mt-1 block w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm bg-[var(--bg-input)] text-[var(--text)] placeholder:text-[var(--text-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {message && (
          <p className="text-xs text-emerald-300 bg-emerald-950/40 border border-emerald-700 rounded-lg px-3 py-2">
            {message}
          </p>
        )}
        {error && (
          <p className="text-xs text-rose-300 bg-rose-950/40 border border-rose-800 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center justify-center rounded-lg bg-[var(--accent)] text-[var(--accent-fg)] font-semibold py-2.5 px-4 text-sm shadow-md hover:bg-[var(--accent-hover)] disabled:opacity-60 disabled:cursor-wait transition cursor-pointer"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </form>

      <div className="border border-rose-800/70 rounded-xl p-4 max-w-md bg-[var(--bg-surface)]">
        <h3 className="text-sm font-semibold text-rose-400 mb-1">
          Danger zone
        </h3>
        <p className="text-xs text-rose-300/80 mb-3">
          Deleting your account will remove all your saved links. This cannot be
          undone.
        </p>
        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="px-3 py-1.5 rounded-full border border-rose-700 text-rose-300 text-xs hover:bg-rose-900/40 cursor-pointer"
          >
            Delete my account
          </button>
        ) : (
          <div className="flex gap-2 items-center text-xs">
            <span className="text-rose-300">
              Are you sure? This is permanent.
            </span>
            <button
              onClick={handleDelete}
              className="px-3 py-1.5 rounded-full bg-rose-600 text-rose-50 hover:bg-rose-500"
            >
              Yes, delete
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="px-3 py-1.5 rounded-full border border-[var(--border)] text-[var(--text-muted)]"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
