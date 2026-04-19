import { useState, type FormEvent } from 'react';
import { createLink, type Link } from '../lib/api';

interface LinkFormProps {
  onCreated: (link: Link) => void;
}

export default function LinkForm({ onCreated }: LinkFormProps) {
  const queryParameters = new URLSearchParams(window.location.search);
  const initialUrl = queryParameters.get('url') ?? '';
  const initialTitle = queryParameters.get('title') ?? '';

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
        <label className="block text-xs font-medium text-[var(--text-muted)]">
          URL
          <input
            type="url"
            required
            placeholder="https://example.com/article"
            className="mt-1 block w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm bg-[var(--bg-input)] text-[var(--text)] placeholder:text-[var(--text-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </label>
      </div>
      <div className="flex-1">
        <label className="block text-xs font-medium text-[var(--text-muted)]">
          Title (optional)
          <input
            type="text"
            placeholder="If blank, we&apos;ll use the URL"
            className="mt-1 block w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm bg-[var(--bg-input)] text-[var(--text)] placeholder:text-[var(--text-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
      </div>
      <button
        type="submit"
        disabled={saving}
        className="sm:w-auto w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--accent)] border border-[var(--accent)] text-[var(--accent-fg)] font-semibold py-2 px-4 text-sm shadow-md hover:bg-[var(--accent-hover)] hover:border-[var(--accent-hover)] disabled:opacity-60 disabled:cursor-wait transition"
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
