import { apiFetch, clearStoredToken, setStoredToken } from './core';
import type { LoginResponse } from './core';

export type { LoginResponse };

export async function register(email: string, password: string) {
  return apiFetch(
    '/auth/register',
    {
      body: JSON.stringify({ email, password }),
      method: 'POST',
    },
    false,
  );
}

export async function login(
  email: string,
  password: string,
): Promise<LoginResponse> {
  const data = await apiFetch<LoginResponse>(
    '/auth/login',
    {
      body: JSON.stringify({ email, password }),
      method: 'POST',
    },
    false,
  );

  if ('accessToken' in data) {
    setStoredToken(data.accessToken, data.refreshToken);
  }
  return data;
}

export async function revokeAllSessions(): Promise<void> {
  try {
    await apiFetch('/auth/sessions', { method: 'DELETE' });
  } catch {
    // Best-effort — clear local tokens regardless.
  }
}

export async function logout(): Promise<void> {
  await revokeAllSessions();
  clearStoredToken();
}

export async function getMe() {
  return apiFetch<{
    cvdMode: boolean;
    connectedProviders: Array<{ provider: string; connectedAt: string }>;
    email: string;
    emailVerifiedAt: string | null;
    hasPassword: boolean;
    pendingEmail: string | null;
    mode: string;
    theme: string;
    twoFactorMethod: 'totp' | null;
    twoFactorPending: boolean;
    userId: string;
  }>('/auth/me', {
    method: 'GET',
  });
}

export async function forgotPassword(email: string): Promise<void> {
  await apiFetch(
    '/auth/forgot-password',
    { body: JSON.stringify({ email }), method: 'POST' },
    false,
  );
}

export async function verifyEmail(token: string): Promise<void> {
  await apiFetch(
    '/auth/verify-email',
    { body: JSON.stringify({ token }), method: 'POST' },
    false,
  );
}

export async function resendVerificationEmail(): Promise<void> {
  await apiFetch('/auth/resend-verification', { method: 'POST' });
}

export async function requestEmailChange(
  email: string,
  code?: string,
): Promise<void> {
  const body: Record<string, string> = { email };
  if (code !== undefined) body['code'] = code;
  await apiFetch('/auth/request-email-change', {
    body: JSON.stringify(body),
    method: 'POST',
  });
}

export async function verifyEmailChange(token: string): Promise<void> {
  await apiFetch(
    '/auth/verify-email-change',
    { body: JSON.stringify({ token }), method: 'POST' },
    false,
  );
}

export async function resetPassword(
  token: string,
  password: string,
): Promise<void> {
  await apiFetch(
    '/auth/reset-password',
    { body: JSON.stringify({ token, password }), method: 'POST' },
    false,
  );
}

export async function setupTotp(): Promise<{
  qrCodeDataUrl: string;
  secret: string;
}> {
  return apiFetch('/auth/2fa/totp/setup', { method: 'POST' });
}

export async function verifyTotpSetup(
  code: string,
): Promise<{ recoveryCodes: string[] }> {
  return apiFetch('/auth/2fa/totp/verify', {
    body: JSON.stringify({ code }),
    method: 'POST',
  });
}

export async function registerMagicLink(email: string): Promise<void> {
  await apiFetch(
    '/auth/register-magic-link',
    { body: JSON.stringify({ email }), method: 'POST' },
    false,
  );
}

export async function requestMagicLink(email: string): Promise<void> {
  await apiFetch(
    '/auth/request-magic-link',
    { body: JSON.stringify({ email }), method: 'POST' },
    false,
  );
}

export async function verifyMagicLink(
  token: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  const data = await apiFetch<{ accessToken: string; refreshToken: string }>(
    '/auth/verify-magic-link',
    { body: JSON.stringify({ token }), method: 'POST' },
    false,
  );
  setStoredToken(data.accessToken, data.refreshToken);
  return data;
}

export async function verifyOtp(
  mfaToken: string,
  code: string,
  method: 'totp' | 'recovery',
): Promise<{ accessToken: string; refreshToken: string }> {
  const data = await apiFetch<{ accessToken: string; refreshToken: string }>(
    '/auth/verify-otp',
    { body: JSON.stringify({ mfaToken, code, method }), method: 'POST' },
    false,
  );
  setStoredToken(data.accessToken, data.refreshToken);
  return data;
}

export async function disable2fa(credentials: {
  currentPassword?: string;
  code?: string;
}): Promise<void> {
  await apiFetch('/auth/2fa', {
    body: JSON.stringify(credentials),
    method: 'DELETE',
  });
}

export async function regenerateRecoveryCodes(credentials: {
  currentPassword?: string;
  code?: string;
}): Promise<{ recoveryCodes: string[] }> {
  return apiFetch('/auth/2fa/recovery-codes/regenerate', {
    body: JSON.stringify(credentials),
    method: 'POST',
  });
}

export async function setPassword(password: string): Promise<void> {
  await apiFetch('/auth/set-password', {
    body: JSON.stringify({ password }),
    method: 'POST',
  });
}

export async function unlinkOAuthProvider(provider: string): Promise<void> {
  await apiFetch(`/auth/providers/${encodeURIComponent(provider)}`, {
    method: 'DELETE',
  });
}
