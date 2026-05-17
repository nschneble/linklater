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
