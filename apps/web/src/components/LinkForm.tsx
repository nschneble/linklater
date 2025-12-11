import { FormEvent, useState } from 'react';
import { useTheme } from '../theme/ThemeContext';
import { createLink, type Link } from '../lib/api';

interface LinkFormProps {
  onCreated: (link: Link) => void;
}

export default function LinkForm({ onCreated }: LinkFormProps) {
  const params = new URLSearchParams(window.location.search);
  const initialUrl = params.get('url') ?? '';
  const initialTitle = params.get('title') ?? '';

  const { theme } = useTheme();
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
            className={`mt-1 block w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent ${
              theme === 'light'
                ? 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                : 'bg-slate-950 border-slate-700 text-slate-50'
            }`}
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
            className={`mt-1 block w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent ${
              theme === 'light'
                ? 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                : 'bg-slate-950 border-slate-700 text-slate-50'
            }`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
      </div>
      <button
        type="submit"
        disabled={saving}
        className="sm:w-auto w-full inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-400 border border-emerald-400 text-slate-950 font-semibold py-2 px-4 text-sm shadow-md shadow-emerald-500/30 hover:bg-emerald-300 hover:border-emerald-300 disabled:opacity-60 disabled:cursor-wait transition"
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
