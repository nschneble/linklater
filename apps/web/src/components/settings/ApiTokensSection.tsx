import {
  createApiToken,
  listApiTokens,
  revokeApiToken,
  type ApiToken,
  type CreatedApiToken,
} from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import Alert from '../common/Alert';
import FormInput from '../common/FormInput';
import IconButton from '../common/IconButton';
import PrimaryButton from '../common/PrimaryButton';
import ApiTokensList from './ApiTokensList';
import { Link } from 'react-router-dom';
import { useEffect, useRef, useState, type FormEvent } from 'react';

/**
 * Settings section for managing personal access tokens (PATs).
 *
 * Loads the token list on mount via `GET /tokens`. Provides a form to
 * create a named token and a per-token revoke button. The raw token value
 * is shown once immediately after creation (before dismissing the panel)
 * and is never retrievable again — the UI makes this explicit.
 *
 * API calls:
 * - `GET /tokens` — load the list on mount
 * - `POST /tokens` — create a new token
 * - `DELETE /tokens/:id` — revoke a token
 */
export default function ApiTokensSection() {
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [newToken, setNewToken] = useState<CreatedApiToken | null>(null);
  const [copied, setCopied] = useState(false);

  const nameInputReference = useRef<HTMLInputElement>(null);

  const loadTokens = async () => {
    try {
      const loaded = await listApiTokens();
      setTokens(loaded);
    } catch (error: unknown) {
      setLoadError(getErrorMessage(error, 'Failed to load tokens'));
    }
  };

  useEffect(() => {
    void loadTokens();
  }, []);

  useEffect(() => {
    if (showCreate) {
      nameInputReference.current?.focus();
    }
  }, [showCreate]);

  useEffect(() => {
    if (!copied) {
      return;
    }
    const timeoutId = window.setTimeout(() => setCopied(false), 1000);
    return () => window.clearTimeout(timeoutId);
  }, [copied]);

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    setCreateError(null);
    setCreating(true);
    try {
      const created = await createApiToken(createName);
      setNewToken(created);
      setShowCreate(false);
      setCreateName('');
      await loadTokens();
    } catch (error: unknown) {
      setCreateError(getErrorMessage(error, 'Failed to create token'));
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async () => {
    if (!newToken) {
      return;
    }
    try {
      await navigator.clipboard.writeText(newToken.rawToken);
      setCopied(true);
    } catch {
      // clipboard access denied — user can select/copy manually
    }
  };

  const handleRevoke = async (id: string) => {
    await revokeApiToken(id);
    await loadTokens();
  };

  return (
    <div className="max-w-md space-y-3">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[var(--text)] text-sm font-semibold text-balance">
          API Tokens
        </h3>
        {!showCreate && !newToken && (
          <IconButton
            type="button"
            variant="default"
            onClick={() => setShowCreate(true)}
          >
            <i className="fa-solid fa-plus text-[0.7rem]" aria-hidden="true" />
            Create new token
          </IconButton>
        )}
      </div>

      {loadError && <Alert variant="error">{loadError}</Alert>}

      {showCreate && (
        <form
          className="space-y-4 -mx-6 my-6 p-6 border-y border-[var(--border)] border-dotted"
          onSubmit={(event) => void handleCreate(event)}
        >
          <label
            className="block mb-0 text-[var(--text-muted)] text-xs font-medium"
            htmlFor="token-name"
          >
            New token name
          </label>
          <FormInput
            ref={nameInputReference}
            id="token-name"
            type="text"
            disabled={creating}
            placeholder="e.g. Claude, Twilio"
            onChange={(event) => setCreateName(event.target.value)}
            value={createName}
            maxLength={100}
            required
          />
          {createError && <Alert variant="error">{createError}</Alert>}
          <div className="flex gap-2">
            <PrimaryButton
              className="py-2.5"
              disabled={creating || createName.trim().length === 0}
            >
              <i
                className="fa-solid fa-plug-circle-plus text-[0.7rem]"
                aria-hidden="true"
              />
              {creating ? 'Creating…' : 'Create token'}
            </PrimaryButton>
            <IconButton
              disabled={creating}
              type="button"
              variant="ghost"
              onClick={() => {
                setShowCreate(false);
                setCreateName('');
                setCreateError(null);
              }}
            >
              Do nothing and close this form
            </IconButton>
          </div>
        </form>
      )}

      {newToken && (
        <div className="space-y-4 -mx-6 my-6 p-6 pb-2 border-y border-[var(--border)] border-dotted">
          {/*
           * `role="status"` is scoped to the heading only so the raw token
           * value below is not blurted out as soon as the panel mounts.
           * The token itself is reachable via browse-mode navigation; the
           * aria-label on the <code> further protects it from being read
           * aloud incidentally (shoulder-surfing in shared spaces).
           */}
          <p className="mb-3 text-[var(--text-muted)] text-xs" role="status">
            <span className="text-[var(--text)] font-semibold">
              Your new token has been created.
            </span>{' '}
            It'll only be shown once, so make sure you copy it down before
            navigating away from this page!
          </p>
          <div className="flex flex-col items-start gap-4">
            <code
              aria-label="Personal access token — navigate here to read it character by character"
              className="w-full px-2.5 py-2 bg-[var(--bg-elevated)] border-shadow text-[var(--text)] text-sm font-mono rounded-lg break-all"
            >
              {newToken.rawToken}
            </code>
            <IconButton
              className="group"
              type="button"
              variant="default"
              data-copied={copied ? 'true' : undefined}
              aria-label="Copy to Clipboard"
              onClick={() => void handleCopy()}
            >
              {/*
               * Both icons share a single grid cell so they stack without
               * layout shift and each can scale/blur independently. An
               * `absolute inset-0` overlay would resolve to a zero-area box
               * here (the wrapper would be inline with no intrinsic size).
               * `aria-hidden` on the wrapper keeps AT off the visual stack
               * — the button's `aria-label` is the single source of truth
               * for the name.
               */}
              <span
                aria-hidden="true"
                className="inline-grid place-items-center"
              >
                <span className="col-start-1 row-start-1 opacity-0 blur-xs scale-[0.25] group-data-[copied]:opacity-100 group-data-[copied]:blur-none group-data-[copied]:scale-100 transition-[opacity,filter,scale] duration-300 ease-in-out motion-reduce:transition-none">
                  <i className="fa-solid fa-check text-[0.7rem]" />
                </span>
                <span className="col-start-1 row-start-1 opacity-100 blur-none scale-100 group-data-[copied]:opacity-0 group-data-[copied]:blur-xs group-data-[copied]:scale-[0.25] transition-[opacity,filter,scale] duration-300 ease-in-out motion-reduce:transition-none">
                  <i className="fa-solid fa-copy text-[0.7rem]" />
                </span>
              </span>
              Copy to Clipboard
            </IconButton>
          </div>
          {/*
           * Dedicated polite live region for the copy state change. Adding
           * it as a sibling lets AT announce "Token copied to clipboard"
           * even though the copy button keeps focus (a focused button's
           * own accessible-name change is not reliably re-announced).
           */}
          <span className="sr-only" role="status">
            {copied ? 'Token copied to clipboard' : ''}
          </span>
        </div>
      )}

      <ApiTokensList onRevoke={handleRevoke} tokens={tokens} />

      <p className="pt-2">
        <Link
          to="/settings/api"
          className="inline-flex items-center gap-1.5 text-[var(--text-muted)] hover:text-[var(--accent)] text-xs underline underline-offset-3"
        >
          View the API documentation
          <i
            aria-hidden="true"
            className="fa-solid fa-arrow-right text-[0.7rem]"
          />
        </Link>
      </p>
    </div>
  );
}
