import { deleteMe, updateMe } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { useEffect, useRef, useState, type FormEvent } from 'react';

export default function SettingsView() {
  const { logout, updateEmail, user } = useAuth();

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [email, setEmail] = useState(user?.email ?? '');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const bookmarkletRef = useRef<HTMLAnchorElement>(null);

  // Note: React sanitizes `javascript:` urls that are set declaratively
  // Setting the href via setAttribute (after render) bypasses this

  useEffect(() => {
    if (!bookmarkletRef.current) return;

    const token = localStorage.getItem('linklater_token') ?? '';
    const apiUrl = import.meta.env.VITE_API_BASE_URL as string;
    const code =
      'javascript:(function(){' +
      'var t=' +
      JSON.stringify(token) +
      ',a=' +
      JSON.stringify(apiUrl) +
      ';' +
      "function n(m,k){var e=document.createElement('div');e.textContent=m;" +
      "e.style.cssText='position:fixed;top:16px;right:16px;padding:12px 18px;" +
      'border-radius:8px;font:600 14px/1 system-ui;z-index:2147483647;' +
      'box-shadow:0 4px 16px rgba(0,0,0,.35);transition:opacity .3s;' +
      "color:'+(k?'#020617':'#fff')+';background:'+(k?'#34d399':'#ef4444');" +
      'document.body.appendChild(e);' +
      "setTimeout(function(){e.style.opacity='0';setTimeout(function(){e.remove()},350)},2500)}" +
      "fetch(a+'/links',{method:'POST'," +
      "headers:{'Content-Type':'application/json','Authorization':'Bearer '+t}," +
      'body:JSON.stringify({url:location.href,title:document.title})})' +
      '.then(function(r){r.ok' +
      "?n('Saved to Linklater \u2713',true)" +
      ":r.text().then(function(m){n(m||'Error saving link',false)})})" +
      ".catch(function(){n('Could not reach Linklater',false)})" +
      '})();';
    bookmarkletRef.current.setAttribute('href', code);
  }, []);

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const payload: {
        email?: string;
        currentPassword?: string;
        password?: string;
      } = {};

      if (email && email !== user?.email) payload.email = email;

      if (password) {
        payload.password = password;
        payload.currentPassword = currentPassword;
      }

      if (!payload.email && !payload.password) {
        setMessage('Nothing to update');
      } else {
        await updateMe(payload);
        if (payload.email) updateEmail(payload.email);
        setMessage('Settings updated');
      }

      setCurrentPassword('');
      setPassword('');
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Failed to update settings';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteMe();
      logout();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Failed to delete account';
      setError(message);
    }
  };

  return (
    <div className="space-y-6">
      <form className="max-w-md space-y-4" onSubmit={handleSave}>
        <h2 className="text-[var(--text)] text-xl font-semibold">
          Account settings
        </h2>

        <label className="block text-[var(--text-muted)] text-xs font-medium">
          Email
          <input
            className="block w-full mt-1 px-3 py-2 bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text)] placeholder:text-[var(--text-subtle)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent rounded-lg"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>

        <label className="block text-xs font-medium text-[var(--text-muted)]">
          New password
          <input
            className="block w-full mt-1 px-3 py-2 bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text)] placeholder:text-[var(--text-subtle)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent rounded-lg"
            type="password"
            placeholder="Leave blank to keep current password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>

        {password && (
          <label className="block text-xs font-medium text-[var(--text-muted)]">
            Current password
            <input
              className="block w-full mt-1 px-3 py-2 bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text)] placeholder:text-[var(--text-subtle)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent rounded-lg"
              type="password"
              placeholder="Required to confirm password change"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
            />
          </label>
        )}

        {message && (
          <p
            className="px-3 py-2 bg-emerald-950/40 border border-emerald-700 text-emerald-300 text-xs rounded-lg"
            role="status"
          >
            {message}
          </p>
        )}

        {error && (
          <p
            className="px-3 py-2 bg-rose-950/40 border border-rose-800 text-rose-300 text-xs rounded-lg"
            role="alert"
          >
            {error}
          </p>
        )}

        <button
          className="inline-flex items-center justify-center px-4 py-2.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-fg)] text-sm font-semibold shadow-md rounded-lg cursor-pointer disabled:cursor-wait disabled:opacity-60 transition"
          type="submit"
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </form>

      <div className="max-w-md space-y-3">
        <h3 className="text-[var(--text)] text-sm font-semibold">
          Bookmarklet
        </h3>
        <p className="text-[var(--text-muted)] text-xs">
          Drag this button to your bookmarks bar. Click it on any page to save
          the link directly to Linklater.
        </p>
        <a
          className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--bg-elevated)] hover:bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text)] text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded-full cursor-grab active:cursor-grabbing select-none transition"
          ref={bookmarkletRef}
          onClick={(event) => event.preventDefault()}
          draggable
        >
          <i className="fa-solid fa-bookmark text-[var(--accent)] text-[0.7rem]" />
          Save to Linklater
        </a>
        <p className="text-[var(--text-subtle)] text-xs">
          Your auth token is embedded in this bookmarklet. Keep it private. It
          expires after 90 days. Reinstall it from this page when it does.
        </p>
      </div>

      <div className="max-w-md p-4 bg-[var(--bg-surface)] border border-rose-800/70 rounded-xl">
        <h3 className="mb-1 text-rose-400 text-sm font-semibold">
          Danger zone
        </h3>
        <p className="mb-3 text-rose-300/80 text-xs">
          Deleting your account will remove all your saved links. This cannot be
          undone.
        </p>

        {!confirmDelete ? (
          <button
            className="px-3 py-1.5 hover:bg-rose-900/40 border border-rose-700 text-rose-300 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 rounded-full cursor-pointer"
            type="button"
            onClick={() => setConfirmDelete(true)}
          >
            Delete my account
          </button>
        ) : (
          <div className="flex gap-2 items-center text-xs">
            <span className="text-rose-300">
              Are you sure? This is permanent.
            </span>
            <button
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 rounded-full"
              type="button"
              onClick={handleDelete}
            >
              Yes, delete
            </button>
            <button
              className="px-3 py-1.5 border border-[var(--border)] text-[var(--text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded-full"
              type="button"
              onClick={() => setConfirmDelete(false)}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
