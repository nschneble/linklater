import { apiFetch } from './core';

/** Summary shape; the raw token is deliberately absent. */
export interface ApiToken {
  id: string;
  name: string;
  /** The token's first 12 characters, for telling tokens apart. */
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
}

/** Adds the plaintext token, returned only once, at creation. */
export interface CreatedApiToken extends ApiToken {
  rawToken: string;
}

/** Bookmarklet tokens are excluded; they have their own endpoints. */
export function listApiTokens(): Promise<ApiToken[]> {
  return apiFetch<ApiToken[]>('/tokens');
}

export function createApiToken(name: string): Promise<CreatedApiToken> {
  return apiFetch<CreatedApiToken>('/tokens', {
    body: JSON.stringify({ name }),
    method: 'POST',
  });
}

/**
 * Rejects with 404 when the token is not the caller's, and 400 for a
 * bookmarklet token, which is rotated rather than revoked.
 */
export function revokeApiToken(id: string): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/tokens/${id}`, {
    method: 'DELETE',
  });
}

/**
 * Never expires, and unlike a user-created token its raw value comes back
 * on every call, so the settings page can rebuild the bookmarklet URL on
 * any device. Rotating it is the only way to invalidate it.
 */
export interface BookmarkletToken extends ApiToken {
  rawToken: string;
}

/** Mints one lazily when the user does not have it yet. */
export function getBookmarkletToken(): Promise<BookmarkletToken> {
  return apiFetch<BookmarkletToken>('/tokens/bookmarklet');
}

/** Replaces the old token in one transaction; the old one 401s at once. */
export function regenerateBookmarkletToken(): Promise<BookmarkletToken> {
  return apiFetch<BookmarkletToken>('/tokens/bookmarklet/regenerate', {
    method: 'POST',
  });
}
