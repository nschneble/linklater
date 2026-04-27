import { createLink, type Link } from '../lib/api';
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
      const link = await createLink({ url, title: undefined });
      onCreated(link);
      setUrl('');
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
        <FormInput
          type="url"
          placeholder="https://example.com/article"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          required
        />
      </div>
      <PrimaryButton
        disabled={saving}
        className="w-full sm:w-auto rounded-full!"
      >
        <i className="fa-solid fa-bookmark text-xs" />
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
