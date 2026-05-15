/**
 * Central API client for all communication with the Linklater back-end.
 *
 * Token management: the JWT is stored in `localStorage` under the key
 * `linklater_token` AND in the module-level `storedToken` variable. The
 * in-memory copy avoids a `localStorage` read on every request.
 *
 * All requests go through `apiFetch`, which handles auth headers, JSON
 * parsing, and converting non-2xx responses into `Error` instances with
 * the server's message.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string;

if (!API_BASE_URL) {
  console.warn('VITE_API_BASE_URL is not set');
}

// In-memory cache of the JWT so we do not hit localStorage on every request.
let storedToken: string | null = localStorage.getItem('linklater_token');

/** Returns the currently stored JWT, or `null` if the user is not logged in. */
export function getStoredToken(): string | null {
  return storedToken;
}

/**
 * Persists a JWT to both the in-memory cache and `localStorage`.
 * Called automatically by `login` after a successful authentication response.
 *
 * @param token - The JWT string to store.
 */
export function setStoredToken(token: string): void {
  storedToken = token;
  localStorage.setItem('linklater_token', token);
}

/**
 * Clears the JWT from the in-memory cache and `localStorage`.
 * Called by `logout` and by `AuthContext` when the stored token fails
 * the `/auth/me` check on page load (e.g. expired token).
 */
export function clearStoredToken(): void {
  storedToken = null;
  localStorage.removeItem('linklater_token');
}

/** The shape of a successful POST /auth/login response — either a full session or an MFA challenge. */
export type LoginResponse =
  | { accessToken: string }
  | { mfaToken: string; mfaMethod: 'totp' | 'email' };

/** Error thrown by `apiFetch` on non-2xx responses. Includes the HTTP status code. */
export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/**
 * Core HTTP helper used by every API function in this module.
 *
 * Automatically attaches the `Authorization: Bearer` header when
 * `includeAuth` is `true` (the default). Throws an `Error` with the
 * server's error message when the response status is not 2xx.
 *
 * @param path - The API path relative to `VITE_API_BASE_URL` (e.g. `'/links'`).
 * @param options - Standard `RequestInit` options (method, body, etc.).
 * @param includeAuth - When `false`, the Authorization header is omitted. Use for public endpoints like login and register.
 * @returns The parsed JSON response body.
 * @throws {ApiError} When the response is not OK, with the server's error message and HTTP status.
 */
export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  includeAuth: boolean | string = true,
): Promise<T> {
  let token: string | null = null;
  if (typeof includeAuth === 'string') {
    token = includeAuth;
  } else if (includeAuth) {
    token = storedToken;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const text = await response.text();
    let message = text || `Request failed with ${response.status}`;
    try {
      const body = JSON.parse(text) as { message?: string };
      if (body.message) message = body.message;
    } catch {
      // Body is not JSON — use the raw text as the error message.
    }
    throw new ApiError(message, response.status);
  }

  const text = await response.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

// ---------------------------------------------------------------------------
// Auth endpoints
// ---------------------------------------------------------------------------

/**
 * Endpoint: POST /auth/register
 * Payload: `{ email, password }`
 * Response: The created user object (without passwordHash).
 */
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

/**
 * Endpoint: POST /auth/login
 * Payload: `{ email, password }`
 * Response: `{ accessToken: string }`
 *
 * Stores the returned JWT automatically via `setStoredToken`.
 */
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
    setStoredToken(data.accessToken);
  }
  return data;
}

/**
 * Endpoint: (none — client-side only)
 * Clears the stored JWT. The server has no logout endpoint because JWTs are
 * stateless — the front-end simply discards the token.
 */
export function logout() {
  clearStoredToken();
}

/**
 * Endpoint: GET /auth/me
 * Response: The authenticated user's profile.
 *
 * Called on page load by `AuthContext` to hydrate the session from a stored
 * token, and after login to populate `AuthContext.user`.
 */
export async function getMe() {
  return apiFetch<{
    email: string;
    emailVerifiedAt: string | null;
    hasPassword: boolean;
    pendingEmail: string | null;
    mode: string;
    theme: string;
    twoFactorMethod: 'totp' | 'email' | null;
    twoFactorPending: boolean;
    userId: string;
  }>('/auth/me', {
    method: 'GET',
  });
}

/**
 * Endpoint: POST /auth/forgot-password
 * Payload: `{ email }`
 * Response: 200 (always — even if the email is not found, to prevent enumeration).
 */
export async function forgotPassword(email: string): Promise<void> {
  await apiFetch(
    '/auth/forgot-password',
    { body: JSON.stringify({ email }), method: 'POST' },
    false,
  );
}

/**
 * Endpoint: POST /auth/verify-email
 * Payload: `{ token }`
 * Response: 200 on success.
 */
export async function verifyEmail(token: string): Promise<void> {
  await apiFetch(
    '/auth/verify-email',
    { body: JSON.stringify({ token }), method: 'POST' },
    false,
  );
}

/**
 * Endpoint: POST /auth/resend-verification
 * Payload: (none)
 * Response: 200 on success.
 *
 * Requires a valid JWT (called from `AccountSettingsForm` for authenticated users).
 */
export async function resendVerificationEmail(): Promise<void> {
  await apiFetch('/auth/resend-verification', { method: 'POST' });
}

/**
 * Endpoint: POST /auth/request-email-change
 * Payload: `{ email }` — the desired new email address.
 * Response: 200 on success. A verification link is sent to the new address.
 */
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

/**
 * Endpoint: POST /auth/verify-email-change
 * Payload: `{ token }`
 * Response: 200 on success. The email change is committed.
 */
export async function verifyEmailChange(token: string): Promise<void> {
  await apiFetch(
    '/auth/verify-email-change',
    { body: JSON.stringify({ token }), method: 'POST' },
    false,
  );
}

/**
 * Endpoint: POST /auth/reset-password
 * Payload: `{ token, password }`
 * Response: 200 on success. The password is updated.
 */
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

// ---------------------------------------------------------------------------
// 2FA endpoints
// ---------------------------------------------------------------------------

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

export async function setupEmailTwoFactor(): Promise<void> {
  await apiFetch('/auth/2fa/email/setup', { method: 'POST' });
}

export async function verifyEmailTwoFactorSetup(
  code: string,
): Promise<{ recoveryCodes: string[] }> {
  return apiFetch('/auth/2fa/email/verify', {
    body: JSON.stringify({ code }),
    method: 'POST',
  });
}

export async function resendEmailTwoFactorCode(
  mfaToken: string,
): Promise<void> {
  await apiFetch(
    '/auth/2fa/email/resend',
    { body: JSON.stringify({ mfaToken }), method: 'POST' },
    false,
  );
}

export async function sendReauthEmailCode(): Promise<void> {
  await apiFetch('/auth/2fa/email/reauth-send', { method: 'POST' });
}

export async function verifyOtp(
  mfaToken: string,
  code: string,
  method: 'totp' | 'email' | 'recovery',
): Promise<{ accessToken: string }> {
  const data = await apiFetch<{ accessToken: string }>(
    '/auth/verify-otp',
    { body: JSON.stringify({ mfaToken, code, method }), method: 'POST' },
    false,
  );
  setStoredToken(data.accessToken);
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

// ---------------------------------------------------------------------------
// Link types and endpoints
// ---------------------------------------------------------------------------

/** Metadata associated with a saved link, populated asynchronously after save. */
export interface LinkMeta {
  /** The page title from OG/Twitter tags or `<title>`. */
  title?: string | null;
  /** The page description. Truncated to 500 characters. */
  description?: string | null;
  /** The OG or Twitter card image URL. */
  imageUrl?: string | null;
  /** The OG site name. */
  siteName?: string | null;
  /** The page favicon URL. */
  faviconUrl?: string | null;
  /**
   * ISO timestamp of when metadata was last fetched. `null` means the fetch
   * is still pending. The front-end polls `GET /links/:id` until this is set.
   */
  fetchedAt?: string | null;
}

/** A saved link as returned by the API. */
export interface Link {
  /** UUID assigned by the database. */
  id: string;
  /** The saved URL. */
  url: string;
  /** ISO timestamp of when the link was created or re-added to the unread list. */
  createdAt: string;
  /** ISO timestamp of the last update. */
  updatedAt: string;
  /** ISO timestamp of when the link was read. `null` means the link is unread. */
  readAt?: string | null;
  /** The associated metadata. `null` while the fetch job is pending. */
  meta?: LinkMeta | null;
}

/**
 * Endpoint: GET /links/:id
 * Response: A single link with its metadata.
 */
export async function getLink(id: string): Promise<Link> {
  return apiFetch<Link>(`/links/${id}`);
}

/** The paginated response shape returned by GET /links. */
export interface PaginatedLinks {
  /** The links on the current page. */
  data: Link[];
  /** Maximum number of results per page (as applied by the server). */
  limit: number;
  /** The current 1-based page number. */
  page: number;
  /** Total number of links matching the query across all pages. */
  total: number;
}

/**
 * Endpoint: GET /links
 * Response: A paginated list of links matching the given filters.
 *
 * @param options.read - When `true`, returns only read links. When `false`, returns only unread links. Omit to return all.
 * @param options.limit - Results per page. Server caps at 100.
 * @param options.page - 1-based page number.
 * @param options.search - Full-text search term. Results are ranked by relevance.
 */
export async function getLinks(options?: {
  read?: boolean;
  limit?: number;
  page?: number;
  search?: string;
}): Promise<PaginatedLinks> {
  const queryParameters = new URLSearchParams();

  if (options?.read !== undefined) {
    if (options.read) {
      queryParameters.set('read', 'true');
    } else {
      queryParameters.set('read', 'false');
    }
  }
  if (options?.limit !== undefined)
    queryParameters.set('limit', String(options.limit));
  if (options?.page !== undefined)
    queryParameters.set('page', String(options.page));
  if (options?.search) queryParameters.set('search', options.search);

  const query = queryParameters.toString();
  const path = query ? `/links?${query}` : '/links';

  return apiFetch<PaginatedLinks>(path);
}

/**
 * Endpoint: POST /links
 * Payload: `{ url }`
 * Response: The created (or resurfaced) link. Metadata fetch is queued asynchronously.
 */
export async function createLink(input: { url: string }): Promise<Link> {
  return apiFetch<Link>('/links', {
    body: JSON.stringify(input),
    method: 'POST',
  });
}

/**
 * Endpoint: PATCH /links/:id
 * Payload: `{}` (no editable fields defined yet)
 * Response: The link unchanged.
 */
export async function updateLink(id: string): Promise<Link> {
  return apiFetch<Link>(`/links/${id}`, {
    body: JSON.stringify({}),
    method: 'PATCH',
  });
}

/**
 * Endpoint: POST /links/:id/read
 * Response: The link with `readAt` set to the current timestamp.
 */
export async function readLink(id: string): Promise<Link> {
  return apiFetch<Link>(`/links/${id}/read`, {
    method: 'POST',
  });
}

/**
 * Endpoint: POST /links/:id/unread
 * Response: The link with `readAt` cleared to `null`.
 */
export async function unreadLink(id: string): Promise<Link> {
  return apiFetch<Link>(`/links/${id}/unread`, {
    method: 'POST',
  });
}

/**
 * Endpoint: POST /links/stumble
 * Response: `{ url: string }` when a random unread link was found and marked
 * as read; `{ url: null }` when the user has no unread links.
 */
export async function stumbleLink(): Promise<{ url: string | null }> {
  return apiFetch<{ url: string | null }>('/links/stumble', { method: 'POST' });
}

/**
 * Endpoint: DELETE /links/:id
 * Response: `{ success: true }`
 */
export async function deleteLink(id: string): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/links/${id}`, {
    method: 'DELETE',
  });
}

/**
 * Endpoint: DELETE /links/read
 * Response: `{ count: number }` — the number of links deleted.
 */
export async function deleteAllReadLinks(): Promise<{ count: number }> {
  return apiFetch<{ count: number }>('/links/read', {
    method: 'DELETE',
  });
}

/**
 * Endpoint: GET /links/random
 * Response: `{ link: Link | null }` — `null` when there are no links to fetch.
 */
export async function getRandomLink(): Promise<{
  link: Link | null;
}> {
  return apiFetch<{ link: Link | null }>('/links/random');
}

/**
 * Endpoint: PATCH /users/me
 * Payload: Any combination of `{ mode, password, currentPassword, theme }`.
 * Response: Updated user profile (without passwordHash).
 *
 * Used by `AppShell` to persist theme and mode changes, and by
 * `AccountSettingsForm` to change password.
 */
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

/**
 * Endpoint: DELETE /users/me
 * Response: `{ success: true }` — the account and all links are permanently deleted.
 */
export async function deleteMe() {
  return apiFetch<{ success: boolean }>('/users/me', {
    method: 'DELETE',
  });
}
