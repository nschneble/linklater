import { formatRelativeTimeFuzzy } from '../../../lib/dates';
import { getErrorMessage } from '../../../lib/errors';
import { useFocusFirstButton } from '../../../lib/hooks/useFocusFirstButton';
import Alert from '../../common/Alert';
import IconButton from '../../common/IconButton';
import { useRef, useState } from 'react';
import type { ApiTokenRowProps } from './types';

/**
 * A single PAT row, styled to mirror a link card: thick left accent border,
 * name as the title, created-at as the subtitle, last-used as the body.
 * The Revoke button uses the same two-step confirm flow (Sure? → Yes, revoke
 * / Cancel) and lives in the title row.
 *
 * `<time dateTime>` wraps both fuzzy timestamps so assistive tech and
 * tooling can recover the exact ISO value even though the visible text is
 * intentionally vague.
 */
export default function ApiTokenRow({ onRevoke, token }: ApiTokenRowProps) {
  const [confirming, setConfirming] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirmRowReference = useRef<HTMLDivElement>(null);

  useFocusFirstButton(confirmRowReference, confirming);

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
    <li className="relative overflow-visible px-5 py-4 bg-[var(--bg-surface)] border-l-4 border-[var(--accent)] border-shadow hover:border-shadow rounded-r-xl">
      <div className="space-y-1">
        <div className="flex items-start gap-3">
          <div className="flex flex-col items-start min-w-0 flex-1">
            <p className="text-[var(--text)] text-sm text-balance font-semibold tracking-tight sm:tracking-normal line-clamp-1">
              {token.name}
            </p>
            <p className="w-full text-[var(--text-subtle)] text-xs truncate">
              Created{' '}
              <time dateTime={token.createdAt}>
                {formatRelativeTimeFuzzy(token.createdAt)}
              </time>
            </p>
          </div>
          {!confirming ? (
            <IconButton
              aria-label={`Revoke ${token.name}`}
              className="relative shrink-0 z-30"
              type="button"
              variant="danger"
              onClick={() => setConfirming(true)}
            >
              <i
                className="fa-solid fa-xmark text-[0.7rem]"
                aria-hidden="true"
              />
              <span className="hidden sm:inline">Revoke</span>
            </IconButton>
          ) : (
            <div
              className="flex items-center gap-4 shrink-0"
              ref={confirmRowReference}
            >
              <span className="text-rose-700 [[data-mode='dark']_&]:text-rose-300 [[data-theme='nouvelle-vague']_&]:text-gray-700 [[data-theme='nouvelle-vague'][data-mode='dark']_&]:text-gray-400 text-xs">
                Sure?
              </span>
              <div className="space-x-2">
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
            </div>
          )}
        </div>
        <p className="text-[var(--text-muted)] text-xs text-pretty tracking-tight sm:tracking-normal line-clamp-2">
          {token.lastUsedAt ? (
            <>
              This token was last used{' '}
              <time dateTime={token.lastUsedAt}>
                {formatRelativeTimeFuzzy(token.lastUsedAt)}
              </time>
              .
            </>
          ) : (
            'This token has never been used.'
          )}
        </p>
      </div>
      {error && (
        <div className="mt-2">
          <Alert variant="error">{error}</Alert>
        </div>
      )}
    </li>
  );
}
