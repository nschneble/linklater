import {
  createApiToken,
  listApiTokens,
  revokeApiToken,
  type ApiToken,
  type CreatedApiToken,
} from '../../../lib/api';
import { getErrorMessage } from '../../../lib/errors';
import { useTransientState } from '../../../lib/hooks/useTransientState';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useReanchorOnLoad } from '../useReanchorOnLoad';

/**
 * All state and handlers for `ApiTokensSection`.
 *
 * Loads the token list on mount via `GET /tokens`. Provides a form to
 * create a named token and a per-token revoke handler. The raw token value
 * is shown once immediately after creation (before dismissing the panel)
 * and is never retrievable again.
 *
 * API calls:
 * - `GET /tokens` – load the list on mount
 * - `POST /tokens` – create a new token
 * - `DELETE /tokens/:id` – revoke a token
 */
export function useApiTokens() {
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [loaded, setLoaded] = useState(false);
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
      const loadedTokens = await listApiTokens();
      setTokens(loadedTokens);
    } catch (error: unknown) {
      setLoadError(getErrorMessage(error, 'Failed to load tokens'));
    } finally {
      setLoaded(true);
    }
  };

  useEffect(() => {
    void loadTokens();
  }, []);

  // The PAT list resolves after first paint and expands this section, which
  // can shift a deep-linked section below it off the top edge. Re-anchor the
  // active section once the list settles. This is the bottom-most async
  // section, so its load transition is the last one that can drift layout.
  useReanchorOnLoad(loaded);

  useEffect(() => {
    if (showCreate) {
      nameInputReference.current?.focus();
    }
  }, [showCreate]);

  useTransientState(copied, false, setCopied, 1000);

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
      // clipboard access denied – user can select/copy manually
    }
  };

  const handleRevoke = async (id: string) => {
    await revokeApiToken(id);
    if (newToken?.id === id) {
      setNewToken(null);
    }
    await loadTokens();
  };

  return {
    // state
    copied,
    createError,
    createName,
    creating,
    loadError,
    nameInputReference,
    newToken,
    showCreate,
    tokens,
    // handlers
    handleCopy,
    handleCreate,
    handleRevoke,
    setCreateError,
    setCreateName,
    setShowCreate,
  };
}
