import { FormEvent, useEffect, useState } from 'react';
import { useAuth } from './auth/AuthContext';
import { useTheme } from './theme/ThemeContext';
import {
  getLinks,
  createLink,
  archiveLink,
  unarchiveLink,
  deleteLink,
  getRandomLink,
  updateMe,
  deleteMe,
  type Link,
} from './lib/api';
import { gravatarUrl } from './lib/gravatar';

type Mode = 'login' | 'register';
type AppView = 'links' | 'settings';
type LinksFilter = 'active' | 'archived';

function AuthForm() {
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
        err instanceof Error ? JSON.parse(err.message).message : 'Something went dreafully wrong';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const changeModes = async (newMode: string) => {
    setMode(newMode);

    // cleans up the UI to try again
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

function LinkForm({ onCreated }: { onCreated: (link: Link) => void }) {
  const params = new URLSearchParams(window.location.search);
  const initialUrl = params.get('url') ?? '';
  const initialTitle = params.get('title') ?? '';

  const [url, setUrl] = useState(initialUrl);
  const [title, setTitle] = useState(initialTitle);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const link = await createLink({ url, title: title || undefined });
      onCreated(link);
      setUrl('');
      setTitle('');
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to save link';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 sm:flex-row sm:items-end"
    >
      <div className="flex-1">
        <label className="block text-xs font-medium text-slate-300">
          URL
          <input
            type="url"
            required
            placeholder="https://example.com/article"
            className="mt-1 block w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </label>
      </div>
      <div className="flex-1">
        <label className="block text-xs font-medium text-slate-300">
          Title (optional)
          <input
            type="text"
            placeholder="If blank, we&apos;ll use the URL"
            className="mt-1 block w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
      </div>
      <button
        type="submit"
        disabled={saving}
        className="sm:w-auto w-full inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-400 text-slate-950 font-semibold py-2.5 px-4 text-sm shadow-md shadow-emerald-500/30 hover:bg-emerald-300 disabled:opacity-60 disabled:cursor-wait transition"
      >
        <i className="fa-solid fa-bookmark text-xs" />
        {saving ? 'Saving…' : 'Save link'}
      </button>
      {error && (
        <p className="text-xs text-rose-400 bg-rose-950/40 border border-rose-800 rounded-lg px-3 py-2 sm:ml-2">
          {error}
        </p>
      )}
    </form>
  );
}

function LinkCard({
  link,
  onArchiveToggle,
  onDelete,
}: {
  link: Link;
  onArchiveToggle: () => void;
  onDelete: () => void;
}) {
  const created = new Date(link.createdAt).toLocaleString();
  const archived = link.archivedAt
    ? new Date(link.archivedAt).toLocaleString()
    : null;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex-1 min-w-0">
        <a
          href={link.url}
          target="_blank"
          rel="noreferrer"
          className="text-sm font-semibold text-slate-50 hover:text-emerald-300 truncate block"
        >
          {link.title}
        </a>
        <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
          <span className="truncate">{link.host}</span>
          <span className="w-1 h-1 rounded-full bg-slate-600" />
          <span>Saved {created}</span>
          {archived && (
            <>
              <span className="w-1 h-1 rounded-full bg-slate-600" />
              <span className="text-amber-300">Archived {archived}</span>
            </>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 justify-end">
        <button
          onClick={onArchiveToggle}
          className="px-2.5 py-1.5 inline-flex items-center gap-1.5 text-xs rounded-full border border-slate-700 text-slate-200 hover:bg-slate-800"
        >
          <i
            className={
              link.archivedAt
                ? 'fa-solid fa-box-archive text-[0.7rem]'
                : 'fa-regular fa-square-check text-[0.7rem]'
            }
          />
          {link.archivedAt ? 'Unarchive' : 'Archive'}
        </button>

        <button
          onClick={onDelete}
          className="px-2.5 py-1.5 inline-flex items-center gap-1.5 text-xs rounded-full border border-rose-700 text-rose-200 hover:bg-rose-900/70"
        >
          <i className="fa-solid fa-trash-can text-[0.7rem]" />
          Delete
        </button>
      </div>
    </div>
  );
}

function SettingsView() {
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
        <h2 className="text-xl font-semibold text-slate-50">Account settings</h2>

        <label className="block text-xs font-medium text-slate-300">
          Email
          <input
            type="email"
            className="mt-1 block w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>

        <label className="block text-xs font-medium text-slate-300">
          New password
          <input
            type="password"
            placeholder="Leave blank to keep current password"
            className="mt-1 block w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent"
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
          className="inline-flex items-center justify-center rounded-lg bg-emerald-400 text-slate-950 font-semibold py-2.5 px-4 text-sm shadow-md shadow-emerald-500/30 hover:bg-emerald-300 disabled:opacity-60 disabled:cursor-wait transition"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </form>

      <div className="border border-rose-800/70 bg-rose-950/40 rounded-xl p-4 max-w-md">
        <h3 className="text-sm font-semibold text-rose-200 mb-1">
          Danger zone
        </h3>
        <p className="text-xs text-rose-200/80 mb-3">
          Deleting your account will remove all your saved links. This cannot be
          undone.
        </p>
        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="px-3 py-1.5 rounded-full border border-rose-700 text-rose-200 text-xs hover:bg-rose-900/60"
          >
            Delete my account
          </button>
        ) : (
          <div className="flex gap-2 items-center text-xs">
            <span className="text-rose-200">
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
              className="px-3 py-1.5 rounded-full border border-slate-700 text-slate-200"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function AppShell() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [view, setView] = useState<AppView>('links');
  const [links, setLinks] = useState<Link[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<LinksFilter>('active');
  const [randomLoading, setRandomLoading] = useState(false);
  const [randomError, setRandomError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoadingLinks(true);
      try {
        const data = await getLinks({
          search: search || undefined,
          archived: filter === 'archived' ? true : false,
        });
        if (!cancelled) setLinks(data);
      } catch (e) {
        console.error('Failed to load links', e);
      } finally {
        if (!cancelled) setLoadingLinks(false);
      }
    };

    const timeout = setTimeout(load, 200);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [search, filter]);

  const handleCreated = (link: Link) => {
    if (filter === 'archived') return;
    setLinks((prev) => [link, ...prev]);
  };

  const handleToggleArchive = async (link: Link) => {
    try {
      const updated = link.archivedAt
        ? await unarchiveLink(link.id)
        : await archiveLink(link.id);

      setLinks((prev) => {
        // if we’re viewing active links and this just became archived, remove it
        if (filter === 'active' && updated.archivedAt) {
          return prev.filter((l) => l.id !== link.id);
        }

        // if we’re viewing archived links and this just became active, remove it
        if (filter === 'archived' && !updated.archivedAt) {
          return prev.filter((l) => l.id !== link.id);
        }

        // otherwise, just update the item in place
        return prev.map((l) => (l.id === link.id ? updated : l));
      });
    } catch (err: unknown) {
      console.error('Failed to toggle archive state', err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteLink(id);
      setLinks((prev) => prev.filter((l) => l.id !== id));
    } catch (err: unknown) {
      console.error('Failed to delete link', err);
    }
  };

  const handleRandom = async () => {
    setRandomError(null);
    setRandomLoading(true);
    try {
      const { link } = await getRandomLink({
        archived: filter === 'archived',
      });
      if (!link) {
        setRandomError('No links available to randomize');
      } else {
        window.open(link.url, '_blank', 'noopener,noreferrer');
      }
    } catch (err: unknown) {
      setRandomError('Failed to get a random link', err);
    } finally {
      setRandomLoading(false);
    }
  };

  const avatarUrl = user ? gravatarUrl(user.email, 64) : '';

  return (
    <div
      className={`min-h-screen ${
        theme === 'light'
          ? 'bg-slate-50 text-slate-900'
          : 'bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 text-slate-50'
      }`}
    >
      <header
        className={`border-b ${
          theme === 'light' ? 'border-slate-200 bg-white' : 'border-slate-800'
        }`}
      >
        <div className="max-w-5xl mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <img className="h-8 w-8 rounded-xl" src="/linklater.svg" alt="Richard Linklater" />
            <div>
              <div
                className={`font-semibold text-sm ${
                  theme === 'light' ? 'text-slate-900' : 'text-slate-50'
                }`}
              >
                Linklater
              </div>
              <div
                className={`text-xs ${
                  theme === 'light' ? 'text-slate-500' : 'text-slate-400'
                }`}
              >
                Save links now, read them later.
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 text-sm">
            <button
              onClick={toggleTheme}
              className="px-2 py-1.5 inline-flex items-center gap-1.5 rounded-full border border-slate-700/70 text-xs text-slate-200 hover:bg-slate-800/70"
            >
              <i
                className={
                  theme === 'light'
                    ? 'fa-solid fa-moon text-[0.7rem]'
                    : 'fa-solid fa-sun text-[0.7rem]'
                }
              />
              {theme === 'light' ? 'Dark mode' : 'Light mode'}
            </button>

            <button
              onClick={() => setView('links')}
              className={`px-2 py-1.5 rounded-full text-xs ${
                view === 'links'
                  ? 'bg-slate-100 text-slate-900 font-semibold'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              Links
            </button>
            <button
              onClick={() => setView('settings')}
              className={`px-2 py-1.5 rounded-full text-xs ${
                view === 'settings'
                  ? 'bg-slate-100 text-slate-900 font-semibold'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              Settings
            </button>

            <div className="flex items-center gap-2">
              {avatarUrl && (
                <img
                  src={avatarUrl}
                  alt={user?.email}
                  className="h-8 w-8 rounded-full border border-slate-700"
                />
              )}
              <span className="hidden sm:inline text-slate-300 text-xs">
                {user?.email}
              </span>
              <button
                onClick={logout}
                className="px-3 py-1.5 rounded-full border border-slate-700 text-slate-200 hover:bg-slate-800 text-xs"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {view === 'links' ? (
          <>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="w-full space-y-1">
                <h2 className="text-lg font-semibold">
                  {filter === 'archived' ? 'Archived links' : 'Your links'}
                </h2>
                <p className="mt-1 text-xs text-slate-400">
                  {filter === 'archived'
                    ? "Review things you've already read or decided to move aside."
                    : "Add links, search, archive, and let Linklater pick something at random when you're indecisive."}
                </p>

                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="inline-flex rounded-full bg-slate-900/80 border border-slate-700 p-1 text-xs">
                    <button
                      type="button"
                      onClick={() => setFilter('active')}
                      className={`px-3 py-1.5 rounded-full transition ${
                        filter === 'active'
                          ? 'bg-slate-100 text-slate-900 font-semibold'
                          : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      Your links
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilter('archived')}
                      className={`px-3 py-1.5 rounded-full transition ${
                        filter === 'archived'
                          ? 'bg-slate-100 text-slate-900 font-semibold'
                          : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      Archived
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleRandom}
                    disabled={randomLoading}
                    className="px-3 py-1.5 inline-flex items-center gap-1.5 rounded-full border border-slate-700 text-slate-200 hover:bg-slate-800 text-xs disabled:opacity-60"
                  >
                    <i className="fa-solid fa-shuffle text-[0.7rem]" />
                    {randomLoading ? 'Rolling…' : 'Random link'}
                  </button>
                </div>
              </div>
            </div>

            <LinkForm onCreated={handleCreated} />

            <div className="flex items-center gap-2 mt-4">
              <input
                type="search"
                placeholder="Search by title, URL, or host…"
                className="flex-1 rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {randomError && (
              <p className="text-xs text-amber-300 bg-amber-950/40 border border-amber-800 rounded-lg px-3 py-2">
                {randomError}
              </p>
            )}

            <div className="mt-4 space-y-3">
              {loadingLinks ? (
                <p className="text-sm text-slate-400">Loading links…</p>
              ) : links.length === 0 ? (
                <p className="text-sm text-slate-400">
                  No links yet. Paste a URL above to get started.
                </p>
              ) : (
                links.map((link) => (
                  <LinkCard
                    key={link.id}
                    link={link}
                    onArchiveToggle={() => handleToggleArchive(link)}
                    onDelete={() => handleDelete(link.id)}
                  />
                ))
              )}
            </div>
          </>
        ) : (
          <SettingsView />
        )}
      </main>
    </div>
  );
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-200">
        <div className="animate-pulse text-sm text-slate-400">
          Warming up Linklater…
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 px-4">
        <AuthForm />
      </div>
    );
  }

  return <AppShell />;
}
