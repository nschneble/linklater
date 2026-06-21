import { apiFetch } from './core';
import type { CustomTheme } from '../../theme/customTheme';

export function updateMe(input: {
  currentPassword?: string;
  customTheme?: CustomTheme;
  cvdMode?: boolean;
  mode?: string;
  password?: string;
  theme?: string;
}): Promise<void> {
  return apiFetch('/users/me', {
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
