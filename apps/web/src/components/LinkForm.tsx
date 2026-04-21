import { createLink, type Link } from '../lib/api';
import { useState, type FormEvent } from 'react';

interface LinkFormProps {
  onCreated: (link: Link) => void;
}

export default function LinkForm({ onCreated }: LinkFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState(
    () => new URLSearchParams(window.location.search).get('title') ?? '',
  );
  const [url, setUrl] = useState(
    () => new URLSearchParams(window.location.search).get('url') ?? '',
  );

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const link = await createLink({ url, title: title || undefined });
      onCreated(link);
      setUrl('');
      setTitle('');
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Failed to save link';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      className="flex flex-col sm:flex-row gap-3 sm:items-end"
      onSubmit={handleSubmit}
    >
      <div className="flex-1">
        <label className="block text-[var(--text-muted)] text-xs font-medium">
          URL
          <input
            className="block w-full mt-1 px-3 py-2 bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text)] placeholder:text-[var(--text-subtle)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent rounded-lg"
            type="url"
            placeholder="https://example.com/article"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            required
          />
        </label>
      </div>
      <div className="flex-1">
        <label className="block text-[var(--text-muted)] text-xs font-medium">
          Title (optional)
          <input
            className="block w-full mt-1 px-3 py-2 bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text)] placeholder:text-[var(--text-subtle)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent rounded-lg"
            type="text"
            placeholder="If blank, we'll use the url"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
      </div>
      <button
        className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] border border-[var(--accent)] hover:border-[var(--accent-hover)] text-[var(--accent-fg)] text-sm font-semibold shadow-md rounded-lg disabled:opacity-60 disabled:cursor-wait transition"
        type="submit"
        disabled={saving}
      >
        <i className="fa-solid fa-bookmark text-xs" />
        {saving ? 'Saving…' : 'Save link'}
      </button>
      {error && (
        <p
          className="sm:ml-2 px-3 py-2 bg-rose-950/40 border border-rose-800 text-rose-400 text-xs rounded-lg"
          role="alert"
        >
          {error}
        </p>
      )}
    </form>
  );
}
