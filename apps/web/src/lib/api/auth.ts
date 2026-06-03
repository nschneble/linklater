import { ApiError, apiFetch, clearStoredToken, setStoredToken } from './core';
import type { LoginResponse } from './core';

export type { LoginResponse };

/**
 * The shape of the `GET /auth/me` response. Named here so callers and
 * mappers (e.g. `mapMeToUser`) can reference it directly rather than
 * deriving it via `Awaited<ReturnType<typeof getMe>>`.
 */
export interface MeResponse {
  cvdMode: boolean;
  connectedProviders: Array<{
    provider: string;
    providerEmail: string;
    connectedAt: string;
  }>;
  email: string;
  emailVerifiedAt: string | null;
  hasPassword: boolean;
  pendingEmail: string | null;
  mode: string;
  theme: string;
  multiFactorMethod: 'totp' | null;
  multiFactorPending: boolean;
  userId: string;
  welcomedAt: string | null;
}

/**
 * Creates a new account. Does not store a token or sign the user in —
 * callers (e.g. `useAuthState.register`) are responsible for following up
 * with a `login()` call so the token-storage side-effect stays explicit and
 * testable.
 */
export async function register(email: string, password: string): Promise<void> {
  await apiFetch(
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

  if (data === undefined) {
    throw new ApiError('Login endpoint returned an empty response', 0);
  }

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

export async function getMe(): Promise<MeResponse> {
  const data = await apiFetch<MeResponse>('/auth/me', { method: 'GET' });
  if (data === undefined) {
    throw new ApiError('/auth/me returned an empty response', 0);
  }
  return data;
}

export async function acknowledgeWelcome(): Promise<void> {
  await apiFetch('/auth/welcome', { method: 'POST' });
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

/**
 * Starts or resumes TOTP enrollment.
 * `POST /auth/mfa/totp/setup`
 *
 * Idempotent: if a setup is already pending, the server returns the same
 * QR code so a scan in progress is not invalidated.
 *
 * @returns `{ qrCodeDataUrl, secret }` — the QR image data-URL and the
 *   base-32 secret for manual entry.
 * @throws {ApiError} 409 when TOTP is already fully enabled.
 */
export async function setupTotp(): Promise<{
  qrCodeDataUrl: string;
  secret: string;
}> {
  const data = await apiFetch<{ qrCodeDataUrl: string; secret: string }>(
    '/auth/mfa/totp/setup',
    { method: 'POST' },
  );
  if (data === undefined) {
    throw new ApiError('TOTP setup returned an empty response', 0);
  }
  return data;
}

/**
 * Completes TOTP enrollment by verifying the 6-digit code.
 * `POST /auth/mfa/totp/verify`
 *
 * @param code - The current 6-digit code from the authenticator app.
 * @returns `{ recoveryCodes }` — 10 plaintext codes shown exactly once.
 * @throws {ApiError} 400 when there is no pending setup or the code is
 *   invalid.
 */
export async function verifyTotpSetup(
  code: string,
): Promise<{ recoveryCodes: string[] }> {
  const data = await apiFetch<{ recoveryCodes: string[] }>(
    '/auth/mfa/totp/verify',
    { body: JSON.stringify({ code }), method: 'POST' },
  );
  if (data === undefined) {
    throw new ApiError('TOTP verification returned an empty response', 0);
  }
  return data;
}

/**
 * Cancels an in-flight TOTP enrollment, clearing the pending secret
 * server-side. Safe to call even when no setup is pending (no-op).
 * `DELETE /auth/mfa/totp/setup`
 *
 * @throws {ApiError} 409 when TOTP is already fully enabled (use
 *   `disableMfa` instead).
 */
export async function cancelTotpSetup(): Promise<void> {
  await apiFetch('/auth/mfa/totp/setup', { method: 'DELETE' });
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

export async function verifyMagicLink(token: string): Promise<LoginResponse> {
  // The server routes magic-link verification through the same `login()`
  // helper as password sign-in, so an MFA-enabled account answering a magic
  // link gets back an `mfaToken` challenge instead of an access token.
  // Returning `LoginResponse` keeps that branch visible to the caller and
  // prevents a silent destructure failure for users with TOTP turned on.
  const data = await apiFetch<LoginResponse>(
    '/auth/verify-magic-link',
    { body: JSON.stringify({ token }), method: 'POST' },
    false,
  );

  if (data === undefined) {
    throw new ApiError('Magic-link verification returned an empty response', 0);
  }

  if ('accessToken' in data) {
    setStoredToken(data.accessToken, data.refreshToken);
  }
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

  if (data === undefined) {
    throw new ApiError('OTP verification returned an empty response', 0);
  }

  setStoredToken(data.accessToken, data.refreshToken);
  return data;
}

export async function disableMfa(credentials: {
  currentPassword?: string;
  code?: string;
}): Promise<void> {
  await apiFetch('/auth/mfa', {
    body: JSON.stringify(credentials),
    method: 'DELETE',
  });
}

export function confirmAccountDeletion(token: string): Promise<void> {
  return apiFetch(
    '/auth/account-deletion/confirm',
    {
      body: JSON.stringify({ token }),
      method: 'POST',
    },
    false,
  );
}

export async function cancelPendingAccountDeletion(): Promise<void> {
  await apiFetch('/auth/account-deletion/pending', { method: 'DELETE' });
}

export async function regenerateRecoveryCodes(credentials: {
  currentPassword?: string;
  code?: string;
}): Promise<{ recoveryCodes: string[] }> {
  const data = await apiFetch<{ recoveryCodes: string[] }>(
    '/auth/mfa/recovery-codes/regenerate',
    {
      body: JSON.stringify(credentials),
      method: 'POST',
    },
  );
  if (data === undefined) {
    throw new ApiError(
      'Recovery-code regeneration returned an empty response',
      0,
    );
  }
  return data;
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

/**
 * Initiates an OAuth account-linking flow by asking the API for the
 * provider's authorization URL. The SPA then navigates the browser to
 * that URL. We do this via `fetch` (rather than a top-level redirect to
 * the API endpoint directly) so the bearer JWT can be attached, since
 * the endpoint is protected by `JwtAuthGuard`.
 */
export async function initiateOAuthLink(
  provider: string,
): Promise<{ url: string }> {
  const data = await apiFetch<{ url: string }>(
    `/auth/${encodeURIComponent(provider)}/link`,
    { method: 'GET' },
  );
  if (data === undefined) {
    throw new ApiError('OAuth link initiation returned an empty response', 0);
  }
  return data;
}
