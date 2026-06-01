import { apiFetch } from './core';

/** A personal access token summary. `rawToken` is never included here — it
 * is only present in `CreatedApiToken` at creation time. */
export interface ApiToken {
  id: string;
  /** User-supplied label (e.g. "Chrome Extension"). */
  name: string;
  /** First 12 characters of the raw token for visual identification. */
  prefix: string;
  createdAt: string;
  /** `null` if the token has never been used to make a request. */
  lastUsedAt: string | null;
}

/** Extends `ApiToken` with the one-time plaintext token value. Only returned
 * by the create endpoint — never by the list endpoint. */
export interface CreatedApiToken extends ApiToken {
  /** Full raw token including the `ltk_` prefix. Copy it now — it will
   * not be shown again. */
  rawToken: string;
}

/**
 * Fetches all personal access token summaries for the authenticated user.
 * `GET /tokens`
 *
 * Bookmarklet tokens (`kind = BOOKMARKLET`) are excluded — they are
 * managed through `getBookmarkletToken` / `regenerateBookmarkletToken`.
 *
 * @returns Array of token summaries without `rawToken`.
 */
export function listApiTokens(): Promise<ApiToken[]> {
  return apiFetch<ApiToken[]>('/tokens');
}

/**
 * Creates a new personal access token.
 * `POST /tokens`
 *
 * @param name - A label the user can use to identify this token later.
 * @returns The new token record including the one-time `rawToken`.
 */
export function createApiToken(name: string): Promise<CreatedApiToken> {
  return apiFetch<CreatedApiToken>('/tokens', {
    body: JSON.stringify({ name }),
    method: 'POST',
  });
}

/**
 * Permanently deletes a personal access token. Any subsequent request that
 * presents the revoked token will receive a 401.
 * `DELETE /tokens/:id`
 *
 * @param id - UUID of the token to revoke.
 * @throws {ApiError} 404 when the token does not belong to the current user.
 * @throws {ApiError} 400 when the token is a bookmarklet token (use
 *   `regenerateBookmarkletToken` instead).
 */
export function revokeApiToken(id: string): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/tokens/${id}`, {
    method: 'DELETE',
  });
}

/**
 * Bookmarklet PAT (`kind = BOOKMARKLET` server-side). Unlike user-created
 * PATs, the raw token is returned on every call so the settings page can
 * embed it into the `javascript:` URL on any device or browser reload.
 * The token never expires — it can only be invalidated by calling
 * `regenerateBookmarkletToken`.
 */
export interface BookmarkletToken extends ApiToken {
  /** Full raw token including the `ltk_` prefix. Unlike `CreatedApiToken`,
   * this is available on every call to `getBookmarkletToken`. */
  rawToken: string;
}

/**
 * Returns the authenticated user's bookmarklet token, minting a new one
 * if none exists yet (lazy provisioning).
 * `GET /tokens/bookmarklet`
 *
 * @returns The bookmarklet token including its raw value.
 */
export function getBookmarkletToken(): Promise<BookmarkletToken> {
  return apiFetch<BookmarkletToken>('/tokens/bookmarklet');
}

/**
 * Atomically replaces the user's bookmarklet token. The previous token is
 * deleted in the same transaction — any bookmarklet still using the old
 * token will receive a 401 immediately after this call returns.
 * `POST /tokens/bookmarklet/regenerate`
 *
 * @returns The new bookmarklet token including its raw value.
 */
export function regenerateBookmarkletToken(): Promise<BookmarkletToken> {
  return apiFetch<BookmarkletToken>('/tokens/bookmarklet/regenerate', {
    method: 'POST',
  });
}
