import { createLink, type Link } from '../lib/api';
import { getErrorMessage } from '../lib/errors';
import { useState, type FormEvent } from 'react';
import Alert from './ui/Alert';
import FormInput from './ui/FormInput';
import PrimaryButton from './ui/PrimaryButton';

interface LinkFormProps {
  onCreated: (link: Link) => void;
}

export default function LinkForm({ onCreated }: LinkFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [url, setUrl] = useState(
    () => new URLSearchParams(window.location.search).get('url') ?? '',
  );

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const link = await createLink({ url });
      onCreated(link);
      setUrl('');
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Failed to save link'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      className="flex flex-col sm:flex-row gap-3 sm:items-start"
      onSubmit={handleSubmit}
    >
      <div className="flex-1">
        <FormInput
          autoFocus
          type="url"
          placeholder="https://example.com/article"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          required
        />
        <p className="mt-1.5 text-[var(--text-subtle)] text-xs">
          Tip: Paste a link anywhere on the page to save it instantly
        </p>
      </div>
      <PrimaryButton
        disabled={saving}
        className="w-full sm:w-auto my-[5px] rounded-full!"
      >
        <i className="fa-solid fa-bookmark text-xs" aria-hidden="true" />
        {saving ? 'Saving…' : 'Save link'}
      </PrimaryButton>
      {error && (
        <Alert variant="error" className="sm:ml-2">
          {error}
        </Alert>
      )}
    </form>
  );
}
