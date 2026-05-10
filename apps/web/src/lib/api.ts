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

/** The shape of a successful POST /auth/login response. */
export interface LoginResponse {
  accessToken: string;
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
 * @throws {Error} When the response is not OK, with the server's error message as the message.
 */
export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  includeAuth = true,
): Promise<T> {
  const token = includeAuth ? storedToken : null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token && includeAuth) headers['Authorization'] = `Bearer ${token}`;

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
    throw new Error(message);
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
export async function login(email: string, password: string) {
  const data = await apiFetch<LoginResponse>(
    '/auth/login',
    {
      body: JSON.stringify({ email, password }),
      method: 'POST',
    },
    false,
  );

  setStoredToken(data.accessToken);
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
export async function requestEmailChange(email: string): Promise<void> {
  await apiFetch('/auth/request-email-change', {
    body: JSON.stringify({ email }),
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
  /** ISO timestamp of when the link was created (or resurfaced from archive). */
  createdAt: string;
  /** ISO timestamp of the last update. */
  updatedAt: string;
  /** ISO timestamp of when the link was archived. `null` means the link is active (unread). */
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
 * @param options.archived - When `true`, returns only archived links. When `false`, returns only active links. Omit to return all.
 * @param options.limit - Results per page. Server caps at 100.
 * @param options.page - 1-based page number.
 * @param options.search - Full-text search term. Results are ranked by relevance.
 */
export async function getLinks(options?: {
  archived?: boolean;
  limit?: number;
  page?: number;
  search?: string;
}): Promise<PaginatedLinks> {
  const queryParameters = new URLSearchParams();

  if (options?.archived !== undefined) {
    if (options.archived) {
      queryParameters.set('archived', 'true');
    } else {
      queryParameters.set('archived', 'false');
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
 * Endpoint: POST /links/:id/archive
 * Response: The link with `readAt` set to the current timestamp.
 */
export async function archiveLink(id: string): Promise<Link> {
  return apiFetch<Link>(`/links/${id}/archive`, {
    method: 'POST',
  });
}

/**
 * Endpoint: POST /links/:id/unarchive
 * Response: The link with `readAt` cleared to `null`.
 */
export async function unarchiveLink(id: string): Promise<Link> {
  return apiFetch<Link>(`/links/${id}/unarchive`, {
    method: 'POST',
  });
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
 * Endpoint: DELETE /links/archived
 * Response: `{ count: number }` — the number of links deleted.
 */
export async function deleteAllArchivedLinks(): Promise<{ count: number }> {
  return apiFetch<{ count: number }>('/links/archived', {
    method: 'DELETE',
  });
}

/**
 * Endpoint: GET /links/random
 * Response: `{ link: Link | null }` — `null` when no links match the filter.
 *
 * @param options.archived - When `true`, returns a random archived link.
 */
export async function getRandomLink(options?: {
  archived?: boolean;
}): Promise<{ link: Link | null }> {
  const queryParameters = new URLSearchParams();

  if (options?.archived) queryParameters.set('archived', 'true');

  const query = queryParameters.toString();
  const path = query ? `/links/random?${query}` : '/links/random';

  return apiFetch<{ link: Link | null }>(path);
}

// ---------------------------------------------------------------------------
// User endpoints
// ---------------------------------------------------------------------------

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
