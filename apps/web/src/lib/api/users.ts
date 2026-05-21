import { apiFetch } from './core';

export async function updateMe(input: {
  cvdMode?: boolean;
  currentPassword?: string;
  mode?: string;
  password?: string;
  theme?: string;
}): Promise<{ id: string; email: string }> {
  return apiFetch<{ id: string; email: string }>('/users/me', {
    body: JSON.stringify(input),
    method: 'PATCH',
  });
}

export async function deleteMe() {
  return apiFetch<{ success: boolean }>('/users/me', {
    method: 'DELETE',
  });
}
