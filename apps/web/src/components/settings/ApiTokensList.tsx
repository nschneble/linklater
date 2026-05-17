import { useState } from 'react';

import type { ApiToken } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import Alert from '../common/Alert';
import IconButton from '../common/IconButton';

/** Props for a single row in the PAT list. */
interface ApiTokenRowProps {
  /**
   * Called when the user confirms revocation. The parent is responsible
   * for issuing the API call and refreshing the list on completion.
   */
  onRevoke: (id: string) => Promise<void>;
  /** The token summary to display. No raw token value is available here. */
  token: ApiToken;
}

/** Formats an ISO 8601 timestamp as a locale-aware short date string. */
function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * A single row in the PAT list. Shows the token name, display prefix,
 * creation date, and last-used date. Includes a two-step revoke flow:
 * the user first clicks "Revoke", then confirms with "Yes, revoke".
 */
function ApiTokenRow({ onRevoke, token }: ApiTokenRowProps) {
  const [confirming, setConfirming] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRevoke = async () => {
    setError(null);
    setRevoking(true);
    try {
      await onRevoke(token.id);
    } catch (caughtError: unknown) {
      setError(getErrorMessage(caughtError, 'Failed to revoke token'));
      setConfirming(false);
    } finally {
      setRevoking(false);
    }
  };

  return (
    <li className="flex flex-col gap-1.5 px-3 py-2.5 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-[var(--text)] text-xs font-semibold truncate">
            {token.name}
          </span>
          <code className="text-[var(--text-subtle)] text-[0.65rem] font-mono">
            {token.prefix}…
          </code>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!confirming ? (
            <IconButton
              aria-label={`Revoke ${token.name}`}
              type="button"
              variant="danger"
              onClick={() => setConfirming(true)}
            >
              <i
                className="fa-solid fa-xmark text-[0.7rem]"
                aria-hidden="true"
              />
              Revoke
            </IconButton>
          ) : (
            <div className="flex items-center gap-2" role="alert">
              <span className="text-rose-700 [[data-mode='dark']_&]:text-rose-300 text-xs">
                Sure?
              </span>
              <IconButton
                aria-label={`Confirm revoke ${token.name}`}
                disabled={revoking}
                type="button"
                variant="danger-filled"
                onClick={handleRevoke}
              >
                {revoking ? 'Revoking…' : 'Yes, revoke'}
              </IconButton>
              <IconButton
                aria-label={`Cancel revoke ${token.name}`}
                type="button"
                variant="ghost"
                onClick={() => setConfirming(false)}
              >
                Cancel
              </IconButton>
            </div>
          )}
        </div>
      </div>
      <div className="flex gap-3 text-[var(--text-subtle)] text-[0.65rem]">
        <span>Created {formatDate(token.createdAt)}</span>
        <span>
          Last used {token.lastUsedAt ? formatDate(token.lastUsedAt) : 'never'}
        </span>
      </div>
      {error && <Alert variant="error">{error}</Alert>}
    </li>
  );
}

/** Props for the full PAT list component. */
interface ApiTokensListProps {
  /**
   * Passed through to each `ApiTokenRow`. Called with the token ID when
   * the user confirms revocation.
   */
  onRevoke: (id: string) => Promise<void>;
  /** The list of token summaries to render. */
  tokens: ApiToken[];
}

/**
 * Renders the user's personal access tokens as a vertical list of
 * `ApiTokenRow` items. Shows a "No tokens yet." message when the array
 * is empty.
 */
export default function ApiTokensList({
  onRevoke,
  tokens,
}: ApiTokensListProps) {
  if (tokens.length === 0) {
    return <p className="text-[var(--text-subtle)] text-xs">No tokens yet.</p>;
  }

  return (
    <ul className="space-y-2">
      {tokens.map((token) => (
        <ApiTokenRow key={token.id} onRevoke={onRevoke} token={token} />
      ))}
    </ul>
  );
}
