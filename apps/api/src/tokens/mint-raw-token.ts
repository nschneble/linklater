import { randomBytes } from 'node:crypto';

import { sha256Hex } from '../common/crypto-tokens.js';

/** The prefix prepended to every personal access token. Used by `AnyAuthGuard`
 * to distinguish PATs from JWTs without decoding the token. */
export const TOKEN_PREFIX = 'ltk_';

/**
 * Number of characters from the raw token preserved as `prefix`.
 * Stored so the user can visually identify which token is which
 * in the token list without exposing the full secret.
 */
const DISPLAY_PREFIX_LENGTH = 12;

/**
 * Mints a fresh raw PAT plus its SHA-256 hash and display prefix.
 *
 * Pure function – does not touch the database, depend on Nest DI, or read
 * any state. Shared between `TokensService.create` (user-facing PATs) and
 * `BookmarkletTokensService` (the single bookmarklet token per user).
 *
 * Kept out of `TokensService` deliberately so the minting primitive does
 * not leak through the barrel-exported service surface. Any new consumer
 * must import this helper explicitly, making each use site auditable.
 */
export function mintRawToken() {
  const rawToken = TOKEN_PREFIX + randomBytes(24).toString('base64url');
  const tokenHash = sha256Hex(rawToken);
  const prefix = rawToken.slice(0, DISPLAY_PREFIX_LENGTH);
  return { rawToken, tokenHash, prefix };
}
