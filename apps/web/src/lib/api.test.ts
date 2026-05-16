/**
 * Tests for the central API client (`api.ts`).
 *
 * All network calls are intercepted by replacing `globalThis.fetch` with a
 * vi.fn(). Tests verify both the happy path (correct URL, method, headers,
 * returned value) and the error path (non-2xx responses, JSON vs. plain-text
 * error bodies).
 */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from 'vitest';

import {
  ApiError,
  apiFetch,
  createApiToken,
  disable2fa,
  listApiTokens,
  readLink,
  clearStoredToken,
  createLink,
  deleteAllReadLinks,
  deleteLink,
  deleteMe,
  forgotPassword,
  getLink,
  getLinks,
  getMe,
  getRandomLink,
  getStoredRefreshToken,
  getStoredToken,
  login,
  logout,
  regenerateRecoveryCodes,
  register,
  registerMagicLink,
  requestEmailChange,
  requestMagicLink,
  resendVerificationEmail,
  resetPassword,
  revokeAllSessions,
  revokeApiToken,
  setStoredToken,
  setupTotp,
  unreadLink,
  updateLink,
  updateMe,
  verifyEmail,
  verifyEmailChange,
  verifyMagicLink,
  verifyOtp,
  verifyTotpSetup,
} from './api';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockFetch(body: unknown, status = 200): Mock {
  const mock = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(JSON.stringify(body)),
    json: () => Promise.resolve(body),
  });
  globalThis.fetch = mock as unknown as typeof fetch;
  return mock;
}

function mockFetchText(text: string, status = 400): Mock {
  const mock = vi.fn().mockResolvedValue({
    ok: false,
    status,
    text: () => Promise.resolve(text),
    json: () => Promise.resolve({}),
  });
  globalThis.fetch = mock as unknown as typeof fetch;
  return mock;
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  localStorage.clear();
  clearStoredToken();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Token helpers
// ---------------------------------------------------------------------------

describe('token helpers', () => {
  it('getStoredToken returns null when no token is set', () => {
    expect(getStoredToken()).toBeNull();
  });

  it('setStoredToken persists the access token in memory and localStorage', () => {
    setStoredToken('my-jwt');
    expect(getStoredToken()).toBe('my-jwt');
    expect(localStorage.getItem('linklater_token')).toBe('my-jwt');
  });

  it('setStoredToken also persists the refresh token when provided', () => {
    setStoredToken('my-jwt', 'my-refresh');
    expect(getStoredToken()).toBe('my-jwt');
    expect(getStoredRefreshToken()).toBe('my-refresh');
    expect(localStorage.getItem('linklater_refresh_token')).toBe('my-refresh');
  });

  it('setStoredToken leaves the refresh token unchanged when not provided', () => {
    setStoredToken('my-jwt', 'existing-refresh');
    setStoredToken('new-jwt');
    expect(getStoredRefreshToken()).toBe('existing-refresh');
  });

  it('clearStoredToken removes both tokens from memory and localStorage', () => {
    setStoredToken('my-jwt', 'my-refresh');
    clearStoredToken();
    expect(getStoredToken()).toBeNull();
    expect(getStoredRefreshToken()).toBeNull();
    expect(localStorage.getItem('linklater_token')).toBeNull();
    expect(localStorage.getItem('linklater_refresh_token')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// apiFetch — core helper
// ---------------------------------------------------------------------------

describe('apiFetch', () => {
  it('attaches Content-Type application/json header', async () => {
    const fetchMock = mockFetch({ ok: true });
    await apiFetch('/test');
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = options.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('attaches Authorization header when a token is stored', async () => {
    setStoredToken('test-token');
    const fetchMock = mockFetch({ ok: true });
    await apiFetch('/test');
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = options.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer test-token');
  });

  it('omits Authorization header when includeAuth is false', async () => {
    setStoredToken('test-token');
    const fetchMock = mockFetch({ ok: true });
    await apiFetch('/test', {}, false);
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = options.headers as Record<string, string>;
    expect(headers['Authorization']).toBeUndefined();
  });

  it('uses a custom string token when includeAuth is a string', async () => {
    setStoredToken('stored-token');
    const fetchMock = mockFetch({ ok: true });
    await apiFetch('/test', {}, 'custom-mfa-token');
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = options.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer custom-mfa-token');
  });

  it('omits Authorization header when no token is stored', async () => {
    const fetchMock = mockFetch({ ok: true });
    await apiFetch('/test');
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = options.headers as Record<string, string>;
    expect(headers['Authorization']).toBeUndefined();
  });

  it('throws ApiError with server JSON error message on non-2xx response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: () => Promise.resolve(JSON.stringify({ message: 'Invalid input' })),
    }) as unknown as typeof fetch;

    const error = await apiFetch('/test').catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).message).toBe('Invalid input');
    expect((error as ApiError).status).toBe(400);
  });

  it('throws ApiError with raw text when response body is not JSON', async () => {
    mockFetchText('Bad gateway', 502);

    const error = await apiFetch('/test').catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).message).toBe('Bad gateway');
    expect((error as ApiError).status).toBe(502);
  });

  it('throws ApiError with fallback message when response body is empty', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: () => Promise.resolve(''),
    }) as unknown as typeof fetch;

    const error = await apiFetch('/test').catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).message).toBe('Request failed with 503');
    expect((error as ApiError).status).toBe(503);
  });

  it('returns parsed JSON on a 2xx response', async () => {
    mockFetch({ id: 'abc', url: 'https://example.com' });

    const result = await apiFetch<{ id: string; url: string }>('/test');

    expect(result).toEqual({ id: 'abc', url: 'https://example.com' });
  });

  it('returns undefined when the 2xx response body is empty', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(''),
    }) as unknown as typeof fetch;

    const result = await apiFetch('/test');

    expect(result).toBeUndefined();
  });

  it('retries with new token after 401 when a refresh token is stored', async () => {
    setStoredToken('expired-jwt', 'valid-refresh');

    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        // First attempt → 401
        ok: false,
        status: 401,
        text: () =>
          Promise.resolve(JSON.stringify({ message: 'Unauthorized' })),
      })
      .mockResolvedValueOnce({
        // Token refresh → 200
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              accessToken: 'new-jwt',
              refreshToken: 'new-refresh',
            }),
          ),
        json: () =>
          Promise.resolve({
            accessToken: 'new-jwt',
            refreshToken: 'new-refresh',
          }),
      })
      .mockResolvedValueOnce({
        // Retry → 200
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify({ id: 'result' })),
      }) as unknown as typeof fetch;

    const result = await apiFetch<{ id: string }>('/test');

    expect(result).toEqual({ id: 'result' });
    expect(getStoredToken()).toBe('new-jwt');
    expect(getStoredRefreshToken()).toBe('new-refresh');
  });

  it('clears tokens and throws when refresh token is expired', async () => {
    setStoredToken('expired-jwt', 'expired-refresh');

    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () =>
          Promise.resolve(JSON.stringify({ message: 'Unauthorized' })),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () =>
          Promise.resolve(JSON.stringify({ message: 'Invalid refresh token' })),
      }) as unknown as typeof fetch;

    await expect(apiFetch('/test')).rejects.toBeInstanceOf(ApiError);
    expect(getStoredToken()).toBeNull();
    expect(getStoredRefreshToken()).toBeNull();
  });

  it('does not retry when no refresh token is stored', async () => {
    setStoredToken('expired-jwt');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve(JSON.stringify({ message: 'Unauthorized' })),
    }) as unknown as typeof fetch;
    globalThis.fetch = fetchMock;

    await expect(apiFetch('/test')).rejects.toBeInstanceOf(ApiError);
    expect((fetchMock as unknown as Mock).mock.calls).toHaveLength(1);
  });

  it('does not retry when path is /auth/refresh', async () => {
    setStoredToken('expired-jwt', 'valid-refresh');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve(JSON.stringify({ message: 'Unauthorized' })),
    }) as unknown as typeof fetch;
    globalThis.fetch = fetchMock;

    await expect(apiFetch('/auth/refresh', {}, false)).rejects.toBeInstanceOf(
      ApiError,
    );
    expect((fetchMock as unknown as Mock).mock.calls).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Auth endpoints
// ---------------------------------------------------------------------------

describe('register', () => {
  it('POSTs to /auth/register without an Authorization header', async () => {
    const fetchMock = mockFetch({ id: 'user-1', email: 'user@example.com' });

    await register('user@example.com', 'password123');

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/auth/register');
    expect((options as { method: string }).method).toBe('POST');
    const headers = (options as { headers: Record<string, string> }).headers;
    expect(headers['Authorization']).toBeUndefined();
  });
});

describe('login', () => {
  it('POSTs to /auth/login and stores the returned access and refresh tokens', async () => {
    mockFetch({ accessToken: 'fresh-jwt', refreshToken: 'fresh-refresh' });

    await login('user@example.com', 'password123');

    expect(getStoredToken()).toBe('fresh-jwt');
    expect(getStoredRefreshToken()).toBe('fresh-refresh');
  });

  it('returns the login response', async () => {
    mockFetch({ accessToken: 'fresh-jwt', refreshToken: 'fresh-refresh' });

    const result = await login('user@example.com', 'password123');

    expect(result).toEqual({
      accessToken: 'fresh-jwt',
      refreshToken: 'fresh-refresh',
    });
  });

  it('does not store a token when the server returns mfaToken', async () => {
    mockFetch({ mfaToken: 'mfa-tok', mfaMethod: 'totp' });

    await login('user@example.com', 'password123');

    expect(getStoredToken()).toBeNull();
  });

  it('returns mfaToken and mfaMethod when 2FA is required', async () => {
    mockFetch({ mfaToken: 'mfa-tok', mfaMethod: 'email' });

    const result = await login('user@example.com', 'password123');

    expect(result).toEqual({ mfaToken: 'mfa-tok', mfaMethod: 'email' });
  });
});

describe('logout', () => {
  it('clears both stored tokens', async () => {
    mockFetch({ success: true });
    setStoredToken('some-jwt', 'some-refresh');

    await logout();

    expect(getStoredToken()).toBeNull();
    expect(getStoredRefreshToken()).toBeNull();
  });
});

describe('revokeAllSessions', () => {
  it('DELETEs /auth/sessions with auth header', async () => {
    setStoredToken('my-jwt');
    const fetchMock = mockFetch({ success: true });

    await revokeAllSessions();

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/auth/sessions');
    expect((options as { method: string }).method).toBe('DELETE');
  });

  it('does not throw when the server returns an error', async () => {
    setStoredToken('my-jwt');
    mockFetchText('Unauthorized', 401);

    await expect(revokeAllSessions()).resolves.toBeUndefined();
  });
});

describe('getMe', () => {
  it('GETs /auth/me with auth header', async () => {
    setStoredToken('my-jwt');
    const fetchMock = mockFetch({
      userId: 'u1',
      email: 'user@example.com',
      emailVerifiedAt: null,
      pendingEmail: null,
      mode: 'dark',
      theme: 'scanner-darkly',
    });

    await getMe();

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain('/auth/me');
  });
});

describe('forgotPassword', () => {
  it('POSTs to /auth/forgot-password without auth', async () => {
    const fetchMock = mockFetch({});

    await forgotPassword('user@example.com');

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/auth/forgot-password');
    expect((options as { method: string }).method).toBe('POST');
  });
});

describe('verifyEmail', () => {
  it('POSTs to /auth/verify-email with the token', async () => {
    const fetchMock = mockFetch({});

    await verifyEmail('some-token');

    const [url] = fetchMock.mock.calls[0] as [string];
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/auth/verify-email');
    expect((options as { body: string }).body).toContain('some-token');
  });
});

describe('resendVerificationEmail', () => {
  it('POSTs to /auth/resend-verification with auth', async () => {
    setStoredToken('my-jwt');
    const fetchMock = mockFetch({});

    await resendVerificationEmail();

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain('/auth/resend-verification');
  });
});

describe('requestEmailChange', () => {
  it('POSTs to /auth/request-email-change with the new email', async () => {
    setStoredToken('my-jwt');
    const fetchMock = mockFetch({});

    await requestEmailChange('new@example.com');

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/auth/request-email-change');
    expect((options as { body: string }).body).toContain('new@example.com');
  });

  it('includes the code in the request body when provided', async () => {
    setStoredToken('my-jwt');
    const fetchMock = mockFetch({});

    await requestEmailChange('new@example.com', '123456');

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse((options as { body: string }).body) as {
      email: string;
      code: string;
    };
    expect(body.code).toBe('123456');
  });

  it('omits the code field when not provided', async () => {
    setStoredToken('my-jwt');
    const fetchMock = mockFetch({});

    await requestEmailChange('new@example.com');

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse((options as { body: string }).body) as Record<
      string,
      unknown
    >;
    expect(body['code']).toBeUndefined();
  });
});

describe('verifyEmailChange', () => {
  it('POSTs to /auth/verify-email-change without auth', async () => {
    const fetchMock = mockFetch({});

    await verifyEmailChange('change-token');

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/auth/verify-email-change');
    const headers = (options as { headers: Record<string, string> }).headers;
    expect(headers['Authorization']).toBeUndefined();
  });
});

describe('resetPassword', () => {
  it('POSTs to /auth/reset-password with token and password', async () => {
    const fetchMock = mockFetch({});

    await resetPassword('reset-token', 'newpass123');

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/auth/reset-password');
    const body = JSON.parse((options as { body: string }).body) as {
      token: string;
      password: string;
    };
    expect(body.token).toBe('reset-token');
    expect(body.password).toBe('newpass123');
  });
});

// ---------------------------------------------------------------------------
// Link endpoints
// ---------------------------------------------------------------------------

describe('getLink', () => {
  it('GETs /links/:id', async () => {
    const fetchMock = mockFetch({ id: 'link-1', url: 'https://example.com' });

    await getLink('link-1');

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain('/links/link-1');
  });
});

describe('getLinks', () => {
  it('GETs /links with no query params when options are omitted', async () => {
    const fetchMock = mockFetch({
      data: [],
      total: 0,
      page: 1,
      limit: 10,
    });

    await getLinks();

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toMatch(/\/links$/);
  });

  it('appends read=true when read option is true', async () => {
    const fetchMock = mockFetch({ data: [], total: 0, page: 1, limit: 10 });

    await getLinks({ read: true });

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain('read=true');
  });

  it('appends read=false when read option is false', async () => {
    const fetchMock = mockFetch({ data: [], total: 0, page: 1, limit: 10 });

    await getLinks({ read: false });

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain('read=false');
  });

  it('appends search, page, and limit when provided', async () => {
    const fetchMock = mockFetch({ data: [], total: 0, page: 2, limit: 25 });

    await getLinks({ search: 'duck', page: 2, limit: 25 });

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain('search=duck');
    expect(url).toContain('page=2');
    expect(url).toContain('limit=25');
  });
});

describe('createLink', () => {
  it('POSTs to /links with the url payload', async () => {
    const fetchMock = mockFetch(
      { id: 'link-1', url: 'https://example.com' },
      201,
    );

    await createLink({ url: 'https://example.com' });

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/links');
    expect((options as { method: string }).method).toBe('POST');
    const body = JSON.parse((options as { body: string }).body) as {
      url: string;
    };
    expect(body.url).toBe('https://example.com');
  });
});

describe('updateLink', () => {
  it('PATCHes /links/:id', async () => {
    const fetchMock = mockFetch({ id: 'link-1', url: 'https://example.com' });

    await updateLink('link-1');

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/links/link-1');
    expect((options as { method: string }).method).toBe('PATCH');
  });
});

describe('readLink', () => {
  it('POSTs to /links/:id/read', async () => {
    const fetchMock = mockFetch({
      id: 'link-1',
      url: 'https://example.com',
      readAt: new Date().toISOString(),
    });

    await readLink('link-1');

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/links/link-1/read');
    expect((options as { method: string }).method).toBe('POST');
  });
});

describe('unreadLink', () => {
  it('POSTs to /links/:id/unread', async () => {
    const fetchMock = mockFetch({
      id: 'link-1',
      url: 'https://example.com',
      readAt: null,
    });

    await unreadLink('link-1');

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/links/link-1/unread');
    expect((options as { method: string }).method).toBe('POST');
  });
});

describe('deleteLink', () => {
  it('DELETEs /links/:id', async () => {
    const fetchMock = mockFetch({ success: true });

    await deleteLink('link-1');

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/links/link-1');
    expect((options as { method: string }).method).toBe('DELETE');
  });
});

describe('deleteAllReadLinks', () => {
  it('DELETEs /links/read', async () => {
    const fetchMock = mockFetch({ count: 5 });

    await deleteAllReadLinks();

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/links/read');
    expect((options as { method: string }).method).toBe('DELETE');
  });
});

describe('getRandomLink', () => {
  it('GETs /links/random', async () => {
    const fetchMock = mockFetch({ link: null });

    await getRandomLink();

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toMatch(/\/links\/random$/);
  });
});

describe('updateMe', () => {
  it('PATCHes /users/me with the provided fields', async () => {
    setStoredToken('my-jwt');
    const fetchMock = mockFetch({ id: 'u1', email: 'user@example.com' });

    await updateMe({ theme: 'boyhood', mode: 'dark' });

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/users/me');
    expect((options as { method: string }).method).toBe('PATCH');
    const body = JSON.parse((options as { body: string }).body) as {
      theme: string;
      mode: string;
    };
    expect(body.theme).toBe('boyhood');
    expect(body.mode).toBe('dark');
  });
});

describe('deleteMe', () => {
  it('DELETEs /users/me', async () => {
    setStoredToken('my-jwt');
    const fetchMock = mockFetch({ success: true });

    await deleteMe();

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/users/me');
    expect((options as { method: string }).method).toBe('DELETE');
  });
});

// ---------------------------------------------------------------------------
// 2FA endpoints
// ---------------------------------------------------------------------------

describe('setupTotp', () => {
  it('POSTs to /auth/2fa/totp/setup with auth', async () => {
    setStoredToken('my-jwt');
    const fetchMock = mockFetch({ qrCodeDataUrl: 'data:...', secret: 'ABC' });

    await setupTotp();

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/auth/2fa/totp/setup');
    expect((options as { method: string }).method).toBe('POST');
    const headers = (options as { headers: Record<string, string> }).headers;
    expect(headers['Authorization']).toBe('Bearer my-jwt');
  });
});

describe('verifyTotpSetup', () => {
  it('POSTs to /auth/2fa/totp/verify with the 6-digit code', async () => {
    setStoredToken('my-jwt');
    const fetchMock = mockFetch({ recoveryCodes: ['aaaaa-bbbbb'] });

    await verifyTotpSetup('123456');

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/auth/2fa/totp/verify');
    const body = JSON.parse((options as { body: string }).body) as {
      code: string;
    };
    expect(body.code).toBe('123456');
  });
});

describe('requestMagicLink', () => {
  it('POSTs to /auth/request-magic-link with email and no Authorization header', async () => {
    const fetchMock = mockFetch({});

    await requestMagicLink('user@example.com');

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/auth/request-magic-link');
    expect((options as { method: string }).method).toBe('POST');
    const headers = (options as { headers: Record<string, string> }).headers;
    expect(headers['Authorization']).toBeUndefined();
    const body = JSON.parse((options as { body: string }).body) as {
      email: string;
    };
    expect(body.email).toBe('user@example.com');
  });
});

describe('registerMagicLink', () => {
  it('POSTs to /auth/register-magic-link with email and no Authorization header', async () => {
    const fetchMock = mockFetch({});

    await registerMagicLink('user@example.com');

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/auth/register-magic-link');
    expect((options as { method: string }).method).toBe('POST');
    const headers = (options as { headers: Record<string, string> }).headers;
    expect(headers['Authorization']).toBeUndefined();
    const body = JSON.parse((options as { body: string }).body) as {
      email: string;
    };
    expect(body.email).toBe('user@example.com');
  });
});

describe('verifyMagicLink', () => {
  it('POSTs to /auth/verify-magic-link with token and stores the access token', async () => {
    const fetchMock = mockFetch({ accessToken: 'ml-jwt' });

    const result = await verifyMagicLink('my-token');

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/auth/verify-magic-link');
    const body = JSON.parse((options as { body: string }).body) as {
      token: string;
    };
    expect(body.token).toBe('my-token');
    expect(result).toEqual({ accessToken: 'ml-jwt' });
    expect(getStoredToken()).toBe('ml-jwt');
  });
});

describe('verifyOtp', () => {
  it('POSTs to /auth/verify-otp with mfaToken in body and no Authorization header', async () => {
    const fetchMock = mockFetch({ accessToken: 'full-jwt' });

    await verifyOtp('mfa-pending-token', '123456', 'totp');

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/auth/verify-otp');
    const headers = (options as { headers: Record<string, string> }).headers;
    expect(headers['Authorization']).toBeUndefined();
    const body = JSON.parse((options as { body: string }).body) as {
      mfaToken: string;
      code: string;
      method: string;
    };
    expect(body.mfaToken).toBe('mfa-pending-token');
    expect(body.code).toBe('123456');
    expect(body.method).toBe('totp');
  });

  it('stores the access token on success', async () => {
    mockFetch({ accessToken: 'full-jwt' });

    await verifyOtp('mfa-pending-token', '123456', 'totp');

    expect(getStoredToken()).toBe('full-jwt');
  });
});

describe('disable2fa', () => {
  it('DELETEs /auth/2fa with the provided credentials', async () => {
    setStoredToken('my-jwt');
    const fetchMock = mockFetch({});

    await disable2fa({ currentPassword: 'open-sesame' });

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/auth/2fa');
    expect((options as { method: string }).method).toBe('DELETE');
    const body = JSON.parse((options as { body: string }).body) as {
      currentPassword: string;
    };
    expect(body.currentPassword).toBe('open-sesame');
  });
});

describe('regenerateRecoveryCodes', () => {
  it('POSTs to /auth/2fa/recovery-codes/regenerate with credentials', async () => {
    setStoredToken('my-jwt');
    const fetchMock = mockFetch({ recoveryCodes: ['aaaaa-bbbbb'] });

    await regenerateRecoveryCodes({ currentPassword: 'open-sesame' });

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/auth/2fa/recovery-codes/regenerate');
    expect((options as { method: string }).method).toBe('POST');
  });
});

describe('listApiTokens', () => {
  it('GETs /tokens with Authorization header', async () => {
    setStoredToken('my-jwt');
    const tokens = [
      {
        id: 'tok-1',
        name: 'Chrome',
        prefix: 'ltk_aBcDeFgH',
        createdAt: '2026-01-01T00:00:00.000Z',
        lastUsedAt: null,
      },
    ];
    const fetchMock = mockFetch(tokens);

    const result = await listApiTokens();

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/tokens');
    expect((options as { method?: string }).method).toBeUndefined();
    const headers = (options as { headers: Record<string, string> }).headers;
    expect(headers['Authorization']).toBe('Bearer my-jwt');
    expect(result).toEqual(tokens);
  });
});

describe('createApiToken', () => {
  it('POSTs to /tokens with name in body', async () => {
    setStoredToken('my-jwt');
    const created = {
      id: 'tok-1',
      name: 'Chrome',
      prefix: 'ltk_aBcDeFgH',
      createdAt: '2026-01-01T00:00:00.000Z',
      lastUsedAt: null,
      rawToken: 'ltk_aBcDeFgHiJkLmNoPqRsTuVwXyZ12',
    };
    const fetchMock = mockFetch(created, 201);

    const result = await createApiToken('Chrome');

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/tokens');
    expect((options as { method: string }).method).toBe('POST');
    const body = JSON.parse((options as { body: string }).body) as {
      name: string;
    };
    expect(body.name).toBe('Chrome');
    expect(result.rawToken).toBe(created.rawToken);
  });
});

describe('revokeApiToken', () => {
  it('DELETEs /tokens/:id with Authorization header', async () => {
    setStoredToken('my-jwt');
    const fetchMock = mockFetch({ success: true });

    const result = await revokeApiToken('tok-1');

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/tokens/tok-1');
    expect((options as { method: string }).method).toBe('DELETE');
    expect(result).toEqual({ success: true });
  });
});
