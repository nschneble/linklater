import { apiFetch } from './core';

export interface ApiToken {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface CreatedApiToken extends ApiToken {
  rawToken: string;
}

export async function listApiTokens(): Promise<ApiToken[]> {
  return apiFetch<ApiToken[]>('/tokens');
}

export async function createApiToken(name: string): Promise<CreatedApiToken> {
  return apiFetch<CreatedApiToken>('/tokens', {
    body: JSON.stringify({ name }),
    method: 'POST',
  });
}

export async function revokeApiToken(
  id: string,
): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/tokens/${id}`, {
    method: 'DELETE',
  });
}

// Bookmarklet PAT (kind = BOOKMARKLET on the server). Unlike user-created
// PATs, the raw token is returned on every call so the settings page can
// embed it into the `javascript:` URL — even across devices.
export interface BookmarkletToken extends ApiToken {
  rawToken: string;
}

export async function getBookmarkletToken(): Promise<BookmarkletToken> {
  return apiFetch<BookmarkletToken>('/tokens/bookmarklet');
}

export async function regenerateBookmarkletToken(): Promise<BookmarkletToken> {
  return apiFetch<BookmarkletToken>('/tokens/bookmarklet/regenerate', {
    method: 'POST',
  });
}
