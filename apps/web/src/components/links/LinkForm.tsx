import { createLink, type Link } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import Alert from '../common/Alert';
import FormInput from '../common/FormInput';
import PrimaryButton from '../common/PrimaryButton';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';

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
  const errorReference = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    inputReference.current?.focus();
  }, []);

  useEffect(() => {
    if (error) {
      errorReference.current?.focus();
    }
  }, [error]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const link = await createLink({ url });
      onCreated(link);
      setUrl('');
    } catch (caughtError: unknown) {
      setError(getErrorMessage(caughtError, 'Failed to save link'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="flex flex-col sm:flex-row gap-3 sm:items-start">
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
            // conditional so a dangling id never reads as "undefined"
            aria-describedby={error ? 'link-form-error' : undefined}
          />
          <p className="hidden sm:inline-flex mt-1.5 text-[var(--base-subtle-text)] text-xs">
            Tip: Paste a link anywhere on the page to save it instantly
          </p>
        </div>
        <PrimaryButton
          surface="base"
          disabled={saving}
          className="w-full sm:w-auto my-1 sm:my-[7.5px]"
        >
          <i className="fa-solid fa-bookmark text-xs" aria-hidden="true" />
          {saving ? 'Saving…' : 'Save link'}
        </PrimaryButton>
      </div>
      <div className="flex items-center mt-4 min-h-9">
        {error && (
          <Alert
            id="link-form-error"
            ref={errorReference}
            icon="fa-triangle-exclamation"
            tabIndex={-1}
            variant="error"
            className="w-full animate-fade-in-up"
          >
            {error}
          </Alert>
        )}
      </div>
    </form>
  );
}
