import { createLink, type Link } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import Alert from '../common/Alert';
import FormInput from '../common/FormInput';
import PrimaryButton from '../common/PrimaryButton';
import { useEffect, useRef, useState, type FormEvent } from 'react';

interface LinkFormProps {
  onCreated: (link: Link) => void;
}

export default function LinkForm({ onCreated }: LinkFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [url, setUrl] = useState(
    () => new URLSearchParams(window.location.search).get('url') ?? '',
  );
  const inputReference = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputReference.current?.focus();
  }, []);

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
        <label htmlFor="link-url" className="sr-only">
          URL
        </label>
        <FormInput
          id="link-url"
          ref={inputReference}
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
        className="w-full sm:w-auto sm:my-[7.5px]"
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
