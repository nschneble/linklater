import {
  createApiToken,
  listApiTokens,
  revokeApiToken,
  type ApiToken,
  type CreatedApiToken,
} from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import { FOCUS_RING } from '../../lib/styles';
import Alert from '../common/Alert';
import IconButton from '../common/IconButton';
import PrimaryButton from '../common/PrimaryButton';
import ApiTokensList from './ApiTokensList';
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

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    setCreateError(null);
    setCreating(true);
    try {
      const created = await createApiToken(createName);
      setNewToken(created);
      setShowCreate(false);
      setCreateName('');
    } catch (error: unknown) {
      setCreateError(getErrorMessage(error, 'Failed to create token'));
    } finally {
      setCreating(false);
    }
  };

  const handleDone = async () => {
    setNewToken(null);
    setCopied(false);
    await loadTokens();
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
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[var(--text)] text-sm font-semibold text-balance">
          API Tokens
        </h2>
        {!showCreate && !newToken && (
          <IconButton
            type="button"
            variant="default"
            onClick={() => setShowCreate(true)}
          >
            <i className="fa-solid fa-plus text-[0.7rem]" aria-hidden="true" />
            Create token
          </IconButton>
        )}
      </div>

      <p className="text-[var(--text-muted)] text-xs text-pretty">
        Use personal access tokens to save links from browser extensions and
        other tools. Tokens are shown only once at creation time.
      </p>

      {loadError && <Alert variant="error">{loadError}</Alert>}

      {showCreate && (
        <form
          className="flex flex-col gap-2 p-3 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg"
          onSubmit={(event) => void handleCreate(event)}
        >
          <label
            className="text-[var(--text)] text-xs font-semibold"
            htmlFor="token-name"
          >
            Token name
          </label>
          <input
            className={`w-full px-3 py-1.5 bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text)] text-xs rounded-lg ${FOCUS_RING}`}
            disabled={creating}
            id="token-name"
            maxLength={100}
            placeholder="e.g. Chrome Extension"
            ref={nameInputReference}
            required
            type="text"
            value={createName}
            onChange={(event) => setCreateName(event.target.value)}
          />
          {createError && <Alert variant="error">{createError}</Alert>}
          <div className="flex gap-2">
            <PrimaryButton
              disabled={creating || createName.trim().length === 0}
            >
              {creating ? 'Creating…' : 'Create'}
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
              Cancel
            </IconButton>
          </div>
        </form>
      )}

      {newToken && (
        <div
          className="flex flex-col gap-2 p-3 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg"
          role="status"
        >
          <p className="text-[var(--text)] text-xs font-semibold">
            Token created — copy it now
          </p>
          <p className="text-[var(--text-muted)] text-xs">
            This token will not be shown again. Store it somewhere safe.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-2.5 py-1.5 bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text)] text-[0.65rem] font-mono rounded-lg break-all">
              {newToken.rawToken}
            </code>
            <IconButton
              aria-label="Copy token to clipboard"
              type="button"
              variant="default"
              onClick={() => void handleCopy()}
            >
              <i
                className={`fa-solid ${copied ? 'fa-check' : 'fa-copy'} text-[0.7rem]`}
                aria-hidden="true"
              />
              {copied ? 'Copied' : 'Copy'}
            </IconButton>
          </div>
          <div>
            <IconButton
              type="button"
              variant="ghost"
              onClick={() => void handleDone()}
            >
              Done
            </IconButton>
          </div>
        </div>
      )}

      <ApiTokensList onRevoke={handleRevoke} tokens={tokens} />
    </div>
  );
}
