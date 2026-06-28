import {
  apiFetch,
  apiFetchRequired,
  clearStoredToken,
  setStoredToken,
} from './core';

/**
 * The two shapes `POST /auth/login` can return. Accounts without MFA get a
 * session token pair; accounts with TOTP enrolled get an `mfaToken`
 * challenge instead and must complete `verifyOtp` to finish authenticating.
 */
export type LoginResponse =
  | { accessToken: string; refreshToken: string }
  | { mfaToken: string; mfaMethod: 'totp' };

/**
 * `POST /auth/verify-magic-link` shape. Adds `userId` on the non-MFA branch
 * so the SPA can detect a cross-account click (logged into B, link is for A)
 * and revoke B's sessions before swapping. MFA path stays unchanged – the
 * userId is bound to the mfaToken via the nonce and not exposed here.
 */
export type MagicLinkVerifyResponse =
  | { accessToken: string; refreshToken: string; userId: string }
  | { mfaToken: string; mfaMethod: 'totp' };

/**
 * The shape of the `GET /auth/me` response. Named here so callers and
 * mappers (e.g. `mapMeToUser`) can reference it directly rather than
 * deriving it via `Awaited<ReturnType<typeof getMe>>`.
 */
export interface MeResponse {
  cvdMode: boolean;
  /**
   * The user's editable Custom theme as stored in the `customTheme` JSON
   * column — a `{ dark, light }` map of bundle token names to CSS color
   * strings — or `null` when the user has never saved one. Free-form JSON on
   * the wire; narrowed client-side via `normalizeCustomTheme`.
   */
  customTheme: unknown;
  /** Whether the Custom theme is shown in the theme picker. */
  customThemeEnabled: boolean;
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
  accountDeletionPending: boolean;
  userId: string;
  welcomedAt: string | null;
}

/**
 * Creates a new account. Does not store a token or sign the user in –
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
  const data = await apiFetchRequired<LoginResponse>(
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
    // Best-effort – clear local tokens regardless.
  }
}

export async function logout(): Promise<void> {
  await revokeAllSessions();
  clearStoredToken();
}

export async function getMe(): Promise<MeResponse> {
  return apiFetchRequired<MeResponse>('/auth/me', { method: 'GET' });
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

export async function resendEmailChangeVerification(): Promise<void> {
  await apiFetch('/auth/resend-email-change', { method: 'POST' });
}

export async function verifyEmailChange(token: string): Promise<void> {
  await apiFetch(
    '/auth/verify-email-change',
    { body: JSON.stringify({ token }), method: 'POST' },
    false,
  );
}

/**
 * Resets the password using the emailed reset token. On success the server
 * issues a session (or an MFA challenge for TOTP-enrolled accounts) so the
 * user lands signed in without having to retype credentials. Mirrors the
 * `login()` token-storage side-effect: the access/refresh tokens are stored
 * automatically on the non-MFA branch; the MFA branch is returned for the
 * caller to surface MfaView.
 */
export async function resetPassword(
  token: string,
  password: string,
): Promise<LoginResponse> {
  const data = await apiFetchRequired<LoginResponse>(
    '/auth/reset-password',
    { body: JSON.stringify({ token, password }), method: 'POST' },
    false,
  );

  if ('accessToken' in data) {
    setStoredToken(data.accessToken, data.refreshToken);
  }
  return data;
}

/**
 * Starts or resumes TOTP enrollment.
 * `POST /auth/mfa/totp/setup`
 *
 * Idempotent: if a setup is already pending, the server returns the same
 * QR code so a scan in progress is not invalidated.
 *
 * @returns `{ qrCodeDataUrl, secret }` – the QR image data-URL and the
 *   base-32 secret for manual entry.
 * @throws {ApiError} 409 when TOTP is already fully enabled.
 */
export async function setupTotp(): Promise<{
  qrCodeDataUrl: string;
  secret: string;
}> {
  return apiFetchRequired<{ qrCodeDataUrl: string; secret: string }>(
    '/auth/mfa/totp/setup',
    { method: 'POST' },
  );
}

/**
 * Completes TOTP enrollment by verifying the 6-digit code.
 * `POST /auth/mfa/totp/verify`
 *
 * @param code - The current 6-digit code from the authenticator app.
 * @returns `{ recoveryCodes }` – 10 plaintext codes shown exactly once.
 * @throws {ApiError} 400 when there is no pending setup or the code is
 *   invalid.
 */
export async function verifyTotpSetup(
  code: string,
): Promise<{ recoveryCodes: string[] }> {
  return apiFetchRequired<{ recoveryCodes: string[] }>(
    '/auth/mfa/totp/verify',
    { body: JSON.stringify({ code }), method: 'POST' },
  );
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

export async function verifyMagicLink(
  token: string,
): Promise<MagicLinkVerifyResponse> {
  // Does NOT auto-store the returned token pair. The caller (VerifyLoginPage)
  // first compares the returned `userId` against the currently signed-in
  // user, and may keep the existing session (same-account click) or revoke
  // B's sessions first (cross-account click). The server still consumes the
  // magic-link token on every call – single-use semantics hold.
  return apiFetchRequired<MagicLinkVerifyResponse>(
    '/auth/verify-magic-link',
    { body: JSON.stringify({ token }), method: 'POST' },
    false,
  );
}

export async function verifyOtp(
  mfaToken: string,
  code: string,
  method: 'totp' | 'recovery',
): Promise<{ accessToken: string; refreshToken: string }> {
  const data = await apiFetchRequired<{
    accessToken: string;
    refreshToken: string;
  }>(
    '/auth/verify-otp',
    { body: JSON.stringify({ mfaToken, code, method }), method: 'POST' },
    false,
  );

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
  return apiFetchRequired<{ recoveryCodes: string[] }>(
    '/auth/mfa/recovery-codes/regenerate',
    {
      body: JSON.stringify(credentials),
      method: 'POST',
    },
  );
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
  return apiFetchRequired<{ url: string }>(
    `/auth/${encodeURIComponent(provider)}/link`,
    { method: 'GET' },
  );
}
