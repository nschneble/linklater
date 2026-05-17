import { apiFetch } from './core';

export async function updateMe(input: {
  mode?: string;
  password?: string;
  currentPassword?: string;
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
