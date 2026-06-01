import { apiFetch } from './core';

export function updateMe(input: {
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

export function deleteMe(input?: {
  currentPassword?: string;
  code?: string;
}): Promise<{ success: true; requiresEmailConfirmation?: true }> {
  const hasBody = !!(input?.currentPassword || input?.code);
  return apiFetch<{ success: true; requiresEmailConfirmation?: true }>(
    '/users/me',
    {
      ...(hasBody ? { body: JSON.stringify(input) } : {}),
      method: 'DELETE',
    },
  );
}
