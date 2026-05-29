import ApiTokenRow from './ApiTokenRow';
import type { ApiTokensListProps } from './types';

/**
 * Renders the user's personal access tokens as a vertical stack of cards
 * that visually echo the saved-link card. Shows a "You haven't created any
 * tokens" message when the list is empty.
 */
export default function ApiTokensList({
  onRevoke,
  tokens,
}: ApiTokensListProps) {
  if (tokens.length === 0) {
    return (
      <p className="mb-8 text-[var(--text-subtle)] text-xs">
        You haven't created any tokens
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {tokens.map((token) => (
        <ApiTokenRow key={token.id} onRevoke={onRevoke} token={token} />
      ))}
    </ul>
  );
}
