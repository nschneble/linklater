import { useState, useRef, useEffect, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext';
import { updateMe, deleteMe } from '../lib/api';

export default function SettingsView() {
  const { user, logout, updateEmail } = useAuth();
  const [email, setEmail] = useState(user?.email ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const bookmarkletRef = useRef<HTMLAnchorElement>(null);

  // React sanitises javascript: URLs when set declaratively, replacing them with
  // about:blank. Setting the href via setAttribute after render bypasses that.
  useEffect(() => {
    if (!bookmarkletRef.current) return;
    const token = localStorage.getItem('linklater_token') ?? '';
    const apiUrl = import.meta.env.VITE_API_BASE_URL as string;
    const code =
      'javascript:(function(){' +
      'var t=' + JSON.stringify(token) + ',a=' + JSON.stringify(apiUrl) + ';' +
      "function n(m,k){var e=document.createElement('div');e.textContent=m;" +
      "e.style.cssText='position:fixed;top:16px;right:16px;padding:12px 18px;" +
        "border-radius:8px;font:600 14px/1 system-ui;z-index:2147483647;" +
        "box-shadow:0 4px 16px rgba(0,0,0,.35);transition:opacity .3s;" +
        "color:'+(k?'#020617':'#fff')+';background:'+(k?'#34d399':'#ef4444');" +
      "document.body.appendChild(e);" +
      "setTimeout(function(){e.style.opacity='0';setTimeout(function(){e.remove()},350)},2500)}" +
      "fetch(a+'/links',{method:'POST'," +
        "headers:{'Content-Type':'application/json','Authorization':'Bearer '+t}," +
        "body:JSON.stringify({url:location.href,title:document.title})})" +
      ".then(function(r){r.ok" +
        "?n('Saved to Linklater \u2713',true)" +
        ":r.text().then(function(m){n(m||'Error saving link',false)})})" +
      ".catch(function(){n('Could not reach Linklater',false)})" +
      '})();';
    bookmarkletRef.current.setAttribute('href', code);
  }, []);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const payload: { email?: string; password?: string; currentPassword?: string } = {};
      if (email && email !== user?.email) payload.email = email;
      if (password) {
        payload.password = password;
        payload.currentPassword = currentPassword;
      }

      if (!payload.email && !payload.password) {
        setMessage('Nothing to update');
      } else {
        await updateMe(payload);
        if (payload.email) {
          updateEmail(payload.email);
        }
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

        {password && (
          <label className="block text-xs font-medium text-[var(--text-muted)]">
            Current password
            <input
              type="password"
              placeholder="Required to confirm password change"
              className="mt-1 block w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm bg-[var(--bg-input)] text-[var(--text)] placeholder:text-[var(--text-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </label>
        )}

        {message && (
          <p role="status" className="text-xs text-emerald-300 bg-emerald-950/40 border border-emerald-700 rounded-lg px-3 py-2">
            {message}
          </p>
        )}
        {error && (
          <p role="alert" className="text-xs text-rose-300 bg-rose-950/40 border border-rose-800 rounded-lg px-3 py-2">
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

      <div className="max-w-md space-y-3">
        <h3 className="text-sm font-semibold text-[var(--text)]">Bookmarklet</h3>
        <p className="text-xs text-[var(--text-muted)]">
          Drag the button below to your bookmarks bar. Clicking it on any page saves
          the link directly to Linklater — no new tab, no form to fill out.
        </p>
        <a
          ref={bookmarkletRef}
          draggable
          onClick={(e) => e.preventDefault()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text)] text-xs font-semibold cursor-grab active:cursor-grabbing select-none hover:bg-[var(--bg-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] transition"
        >
          <i className="fa-solid fa-bookmark text-[0.7rem] text-[var(--accent)]" />
          Save to Linklater
        </a>
        <p className="text-xs text-[var(--text-subtle)]">
          Your auth token is embedded in this bookmarklet — keep it private. It
          expires after 90 days; reinstall it from this page when it does.
        </p>
      </div>

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
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="px-3 py-1.5 rounded-full border border-rose-700 text-rose-300 text-xs hover:bg-rose-900/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 cursor-pointer"
          >
            Delete my account
          </button>
        ) : (
          <div className="flex gap-2 items-center text-xs">
            <span className="text-rose-300">
              Are you sure? This is permanent.
            </span>
            <button
              type="button"
              onClick={handleDelete}
              className="px-3 py-1.5 rounded-full bg-rose-600 text-rose-50 hover:bg-rose-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
            >
              Yes, delete
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="px-3 py-1.5 rounded-full border border-[var(--border)] text-[var(--text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
