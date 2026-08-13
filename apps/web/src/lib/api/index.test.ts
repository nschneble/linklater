/**
 * Tests for the central API client (`lib/api/`) through its barrel: the
 * request each endpoint builds, and what `apiFetch` does around it.
 *
 * All network calls are intercepted by replacing `globalThis.fetch` with a
 * vi.fn(). What lands here is what only a whole round trip can show: the URL,
 * method and headers an endpoint sends, the renewal that precedes a request
 * carrying a token already out of date, the retry that follows a 401, and the
 * cases where `apiFetch`, `tokenRefresh` and `storage` decide between a
 * spent token and an ended session together. Each of those three modules
 * proves its own arms in its own suite.
 *
 * Leg counts are load-bearing in the pre-flight suite and asserted
 * directly: what that renewal buys is a leg not spent, which no assertion
 * about the response can show.
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
  clearStoredToken,
  createApiToken,
  createLink,
  deleteAllReadLinks,
  deleteLink,
  deleteMe,
  disableMfa,
  forgotPassword,
  getLink,
  getLinks,
  getMe,
  getRandomLink,
  getStoredRefreshToken,
  getStoredToken,
  initiateOAuthLink,
  listApiTokens,
  login,
  logout,
  readLink,
  regenerateRecoveryCodes,
  register,
  registerMagicLink,
  requestEmailChange,
  requestMagicLink,
  resendEmailChangeVerification,
  resendVerificationEmail,
  resetPassword,
  revokeAllSessions,
  revokeApiToken,
  setPassword,
  setStoredToken,
  setupTotp,
  stumbleLink,
  unlinkOAuthProvider,
  unreadLink,
  updateMe,
  verifyEmail,
  verifyEmailChange,
  verifyMagicLink,
  verifyOtp,
  verifyTotpSetup,
} from '.';

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(JSON.stringify(body)),
    json: () => Promise.resolve(body),
  };
}

function mockFetch(body: unknown, status = 200): Mock {
  const mock = vi.fn().mockResolvedValue(jsonResponse(body, status));
  globalThis.fetch = mock as unknown as typeof fetch;
  return mock;
}

/**
 * Answers the renewal leg and the protected request separately, so a test
 * can count what each one cost and read the header the second one carried.
 */
function mockFetchByLeg(renewal: unknown, request: unknown): Mock {
  const mock = vi.fn((input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    return Promise.resolve(url.includes('/auth/refresh') ? renewal : request);
  });
  globalThis.fetch = mock as unknown as typeof fetch;
  return mock;
}

/**
 * Builds a token around a payload. Payloads here are ASCII, so `btoa`
 * covers what `jwt.test.ts` needs a TextEncoder pass for.
 */
function makeToken(payload: unknown): string {
  const segment = btoa(JSON.stringify(payload))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
  return `header.${segment}.signature`;
}

/** A token dated relative to now, negative for one already run out. */
function makeTokenExpiringIn(seconds: number): string {
  return makeToken({
    subject: 'user-1',
    exp: Math.floor(Date.now() / 1000) + seconds,
  });
}

/**
 * The legs a run spent, in order, with the base `apiFetch` interpolates
 * taken back off, so a sequence can be read as a list of paths.
 */
function readPaths(mock: Mock): string[] {
  const base = String(import.meta.env.VITE_API_BASE_URL);
  return mock.mock.calls.map(([url]) => String(url).replace(base, ''));
}

function readAuthorization(call: unknown): string | undefined {
  const [, options] = call as [string, RequestInit];
  return (options.headers as Record<string, string>)['Authorization'];
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

/**
 * Simulates a 2xx response with an empty body. Used to exercise the
 * `ApiError` guards in `auth.ts` that throw when typed endpoints receive
 * `undefined`.
 */
function mockFetchEmptyBody(status = 200): Mock {
  const mock = vi.fn().mockResolvedValue({
    ok: true,
    status,
    text: () => Promise.resolve(''),
    json: () => Promise.resolve(undefined),
  });
  globalThis.fetch = mock as unknown as typeof fetch;
  return mock;
}

beforeEach(() => {
  localStorage.clear();
  clearStoredToken();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

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

  it('omits Authorization header when authContext is false', async () => {
    setStoredToken('test-token');
    const fetchMock = mockFetch({ ok: true });
    await apiFetch('/test', {}, false);
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = options.headers as Record<string, string>;
    expect(headers['Authorization']).toBeUndefined();
  });

  it('uses a custom string token when authContext is a string', async () => {
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

  it('returns parsed JSON on a 2xx response', async () => {
    mockFetch({ id: 'abc', url: 'https://example.com' });

    const result = await apiFetch<{ id: string; url: string }>('/test');

    expect(result).toEqual({ id: 'abc', url: 'https://example.com' });
  });

  it('retries with new token after 401 when a refresh token is stored', async () => {
    setStoredToken('expired-jwt', 'valid-refresh');

    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        // first attempt → 401
        ok: false,
        status: 401,
        text: () =>
          Promise.resolve(JSON.stringify({ message: 'Unauthorized' })),
      })
      .mockResolvedValueOnce({
        // token refresh → 200
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
        // retry → 200
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify({ id: 'result' })),
      }) as unknown as typeof fetch;

    const result = await apiFetch<{ id: string }>('/test');

    expect(result).toEqual({ id: 'result' });
    expect(getStoredToken()).toBe('new-jwt');
    expect(getStoredRefreshToken()).toBe('new-refresh');
  });

  it('refreshes with the token another tab rotated, not the stale cached one', async () => {
    setStoredToken('expired-jwt', 'spent-refresh');
    // the other tab rotated and persisted a successor before this 401
    localStorage.setItem('linklater_refresh_token', 'rotated-refresh');

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () =>
          Promise.resolve(JSON.stringify({ message: 'Unauthorized' })),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              accessToken: 'fresh-jwt',
              refreshToken: 'fresh-refresh',
            }),
          ),
        json: () =>
          Promise.resolve({
            accessToken: 'fresh-jwt',
            refreshToken: 'fresh-refresh',
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify({ id: 'retried' })),
      });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(apiFetch<{ id: string }>('/test')).resolves.toEqual({
      id: 'retried',
    });

    const [, refreshOptions] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(JSON.parse(refreshOptions.body as string)).toEqual({
      refreshToken: 'rotated-refresh',
    });
    expect(getStoredToken()).toBe('fresh-jwt');
  });

  it('keeps the session when another tab rotates the pair mid-refresh', async () => {
    setStoredToken('expired-jwt', 'my-refresh');

    let protectedCallCount = 0;
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();

      if (url.includes('/auth/refresh')) {
        // lands mid-flight, so no storage event precedes the 401
        localStorage.setItem('linklater_token', 'sibling-jwt');
        localStorage.setItem('linklater_refresh_token', 'sibling-refresh');
        return Promise.resolve({
          ok: false,
          status: 401,
          text: () =>
            Promise.resolve(JSON.stringify({ message: 'Invalid refresh' })),
        });
      }

      protectedCallCount += 1;
      if (protectedCallCount === 1) {
        return Promise.resolve({
          ok: false,
          status: 401,
          text: () =>
            Promise.resolve(JSON.stringify({ message: 'Unauthorized' })),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify({ id: 'retried' })),
      });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await apiFetch<{ id: string }>('/test').catch(
      (caught: unknown) => caught,
    );

    // a 401 on a token the sibling replaced says that token is spent
    expect(getStoredRefreshToken()).toBe('sibling-refresh');
    expect(getStoredToken()).toBe('sibling-jwt');
    expect(result).toEqual({ id: 'retried' });

    const [, retryOptions] = fetchMock.mock.calls[2] as [string, RequestInit];
    expect((retryOptions.headers as Record<string, string>).Authorization).toBe(
      'Bearer sibling-jwt',
    );
  });

  it('gives up after one retry when the access token it finds is dead too', async () => {
    setStoredToken('expired-jwt', 'my-refresh');

    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();

      if (url.includes('/auth/refresh')) {
        // the sibling's refresh token landed; its access token has not
        localStorage.setItem('linklater_refresh_token', 'sibling-refresh');
        return Promise.resolve({
          ok: false,
          status: 401,
          text: () =>
            Promise.resolve(JSON.stringify({ message: 'Invalid refresh' })),
        });
      }
      return Promise.resolve({
        ok: false,
        status: 401,
        text: () =>
          Promise.resolve(JSON.stringify({ message: 'Still unauthorized' })),
      });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const error = await apiFetch('/test').catch((caught: unknown) => caught);

    // the retry is one-shot, so its own 401 ends the request
    expect(fetchMock.mock.calls).toHaveLength(3);
    expect((error as ApiError).message).toBe('Still unauthorized');
    expect((error as ApiError).status).toBe(401);
  });

  it('keeps the session when a sibling rotates over a write this tab could not persist', async () => {
    localStorage.setItem('linklater_token', 'older-jwt');
    localStorage.setItem('linklater_refresh_token', 'older-refresh');
    const setItemSpy = vi
      .spyOn(window.localStorage, 'setItem')
      .mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });
    setStoredToken('my-jwt', 'my-refresh');
    // quota frees up; the store still holds the replaced pair
    setItemSpy.mockRestore();

    let protectedCallCount = 0;
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();

      if (url.includes('/auth/refresh')) {
        localStorage.setItem('linklater_token', 'sibling-jwt');
        localStorage.setItem('linklater_refresh_token', 'sibling-refresh');
        return Promise.resolve({
          ok: false,
          status: 401,
          text: () =>
            Promise.resolve(JSON.stringify({ message: 'Invalid refresh' })),
        });
      }

      protectedCallCount += 1;
      if (protectedCallCount === 1) {
        return Promise.resolve({
          ok: false,
          status: 401,
          text: () =>
            Promise.resolve(JSON.stringify({ message: 'Unauthorized' })),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify({ id: 'retried' })),
      });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await apiFetch<{ id: string }>('/test').catch(
      (caught: unknown) => caught,
    );

    // the unpersisted pair is what got spent, not the older stored one
    const [, refreshOptions] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(JSON.parse(refreshOptions.body as string)).toEqual({
      refreshToken: 'my-refresh',
    });
    expect(getStoredRefreshToken()).toBe('sibling-refresh');
    expect(result).toEqual({ id: 'retried' });
  });

  it('does not retry when this tab logs out while the refresh is in flight', async () => {
    setStoredToken('expired-jwt', 'my-refresh');

    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();

      if (url.includes('/auth/refresh')) {
        clearStoredToken();
        return Promise.resolve({
          ok: false,
          status: 401,
          text: () =>
            Promise.resolve(JSON.stringify({ message: 'Invalid refresh' })),
        });
      }
      return Promise.resolve({
        ok: false,
        status: 401,
        text: () =>
          Promise.resolve(JSON.stringify({ message: 'Unauthorized' })),
      });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(apiFetch('/test')).rejects.toBeInstanceOf(ApiError);

    // an empty store is no successor, so nothing is worth retrying against
    expect(fetchMock.mock.calls).toHaveLength(2);
    expect(getStoredToken()).toBeNull();
  });

  it('logs out when a 401 finds only the pair this tab could not persist', async () => {
    localStorage.setItem('linklater_refresh_token', 'older-refresh');
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    // the store goes on serving the pair this rotation replaced
    setStoredToken('my-jwt', 'my-refresh');

    const fetchMock = vi
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
          Promise.resolve(JSON.stringify({ message: 'Invalid refresh' })),
      });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const error = await apiFetch('/test').catch((caught: unknown) => caught);

    // a store older than memory is no successor, so the session has ended
    expect(getStoredRefreshToken()).toBeNull();
    expect(getStoredToken()).toBeNull();
    expect(fetchMock.mock.calls).toHaveLength(2);
    expect((error as ApiError).status).toBe(401);
  });

  it('logs out when a sibling removes the refresh token and the server rejects it', async () => {
    setStoredToken('expired-jwt', 'cached-refresh');
    // this tab keeps its copy; a removal elsewhere is not proof of an end
    localStorage.removeItem('linklater_refresh_token');
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'linklater_refresh_token',
        newValue: null,
      }),
    );

    const fetchMock = vi
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
          Promise.resolve(JSON.stringify({ message: 'Invalid refresh' })),
      });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const error = await apiFetch('/test').catch((caught: unknown) => caught);

    // the cached copy was spent against the server, not assumed dead
    expect(fetchMock.mock.calls).toHaveLength(2);
    const [refreshUrl, refreshOptions] = fetchMock.mock.calls[1] as [
      string,
      RequestInit,
    ];
    expect(refreshUrl).toContain('/auth/refresh');
    expect(JSON.parse(refreshOptions.body as string)).toEqual({
      refreshToken: 'cached-refresh',
    });
    // the server rejected it and no successor is stored: session over
    expect(getStoredToken()).toBeNull();
    expect(getStoredRefreshToken()).toBeNull();
    expect((error as ApiError).status).toBe(401);
  });

  it('clears the dead access token when a 401 finds no refresh token to renew it', async () => {
    // no refresh token, so a 401 proves the access token is dead: clear it
    setStoredToken('dead-jwt');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve(JSON.stringify({ message: 'Unauthorized' })),
    }) as unknown as typeof fetch;
    globalThis.fetch = fetchMock;

    const error = await apiFetch('/test').catch((caught: unknown) => caught);
    // the original 401 still reaches the caller unchanged
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(401);
    // the dead access token is gone
    expect(getStoredToken()).toBeNull();
    // only the original request ran; no refresh leg fired
    expect((fetchMock as unknown as Mock).mock.calls).toHaveLength(1);
  });

  it('does not retry when authContext is false (suppresses the refresh-retry path)', async () => {
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

describe('apiFetch expiry pre-flight', () => {
  it('renews first, sparing the leg a server would refuse', async () => {
    setStoredToken(makeTokenExpiringIn(-60), 'valid-refresh');
    const renewed = makeTokenExpiringIn(3600);

    // stands in for the server, which refuses anything past its expiry
    const fetchMock = vi.fn(
      (input: RequestInfo | URL, options?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('/auth/refresh')) {
          return Promise.resolve(
            jsonResponse({
              accessToken: renewed,
              refreshToken: 'next-refresh',
            }),
          );
        }
        const headers = (options?.headers ?? {}) as Record<string, string>;
        if (headers['Authorization'] !== `Bearer ${renewed}`) {
          return Promise.resolve(
            jsonResponse({ message: 'Unauthorized' }, 401),
          );
        }
        return Promise.resolve(jsonResponse({ userId: 'user-1' }));
      },
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(apiFetch('/auth/me')).resolves.toEqual({ userId: 'user-1' });

    // renewal then request: the refused first leg is never spent
    expect(fetchMock.mock.calls).toHaveLength(2);
    const [renewalUrl] = fetchMock.mock.calls[0] as [string, RequestInit];
    const [requestUrl] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(renewalUrl).toContain('/auth/refresh');
    expect(requestUrl).toContain('/auth/me');
    expect(readAuthorization(fetchMock.mock.calls[1])).toBe(
      `Bearer ${renewed}`,
    );
    expect(getStoredToken()).toBe(renewed);
  });

  it('renews once for the several requests a boot fires at the same time', async () => {
    setStoredToken(makeTokenExpiringIn(-60), 'valid-refresh');
    const renewed = makeTokenExpiringIn(3600);
    const fetchMock = mockFetchByLeg(
      jsonResponse({ accessToken: renewed, refreshToken: 'next-refresh' }),
      jsonResponse({ id: 'result' }),
    );

    await Promise.all([apiFetch('/me'), apiFetch('/links')]);

    // one renewal, not one per request
    const renewalCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).includes('/auth/refresh'),
    );
    expect(renewalCalls).toHaveLength(1);
    expect(fetchMock.mock.calls).toHaveLength(3);
    expect(readAuthorization(fetchMock.mock.calls[1])).toBe(
      `Bearer ${renewed}`,
    );
    expect(readAuthorization(fetchMock.mock.calls[2])).toBe(
      `Bearer ${renewed}`,
    );
  });

  it('sends straight out when the stored token is still in date', async () => {
    const live = makeTokenExpiringIn(3600);
    setStoredToken(live, 'valid-refresh');
    const fetchMock = mockFetchByLeg(
      jsonResponse({ accessToken: 'renewed-jwt' }),
      jsonResponse({ id: 'result' }),
    );

    await apiFetch('/test');

    expect(fetchMock.mock.calls).toHaveLength(1);
    expect(readAuthorization(fetchMock.mock.calls[0])).toBe(`Bearer ${live}`);
  });

  it('sends an opaque API token as-is, having no expiry to read', async () => {
    setStoredToken('ltk_opaque_api_token', 'valid-refresh');
    const fetchMock = mockFetchByLeg(
      jsonResponse({ accessToken: 'renewed-jwt' }),
      jsonResponse({ id: 'result' }),
    );

    await apiFetch('/test');

    expect(fetchMock.mock.calls).toHaveLength(1);
    expect(readAuthorization(fetchMock.mock.calls[0])).toBe(
      'Bearer ltk_opaque_api_token',
    );
  });

  it('sends a token carrying no expiry claim as-is', async () => {
    const undated = makeToken({ subject: 'user-1' });
    setStoredToken(undated, 'valid-refresh');
    const fetchMock = mockFetchByLeg(
      jsonResponse({ accessToken: 'renewed-jwt' }),
      jsonResponse({ id: 'result' }),
    );

    await apiFetch('/test');

    expect(fetchMock.mock.calls).toHaveLength(1);
    expect(readAuthorization(fetchMock.mock.calls[0])).toBe(
      `Bearer ${undated}`,
    );
  });

  it('sends a token whose expiry claim is not a number as-is', async () => {
    const mistyped = makeToken({ subject: 'user-1', exp: '1893456000' });
    setStoredToken(mistyped, 'valid-refresh');
    const fetchMock = mockFetchByLeg(
      jsonResponse({ accessToken: 'renewed-jwt' }),
      jsonResponse({ id: 'result' }),
    );

    await apiFetch('/test');

    expect(fetchMock.mock.calls).toHaveLength(1);
    expect(readAuthorization(fetchMock.mock.calls[0])).toBe(
      `Bearer ${mistyped}`,
    );
  });

  it('leaves a literal token alone even once its expiry has passed', async () => {
    const literal = makeTokenExpiringIn(-60);
    setStoredToken(makeTokenExpiringIn(-60), 'valid-refresh');
    const fetchMock = mockFetchByLeg(
      jsonResponse({ accessToken: 'renewed-jwt' }),
      jsonResponse({ id: 'result' }),
    );

    // a PAT or MFA token belongs to its caller and is not ours to rotate
    await apiFetch('/test', {}, literal);

    expect(fetchMock.mock.calls).toHaveLength(1);
    expect(readAuthorization(fetchMock.mock.calls[0])).toBe(
      `Bearer ${literal}`,
    );
  });

  it('renews nothing for an unauthenticated call', async () => {
    setStoredToken(makeTokenExpiringIn(-60), 'valid-refresh');
    const fetchMock = mockFetchByLeg(
      jsonResponse({ accessToken: 'renewed-jwt' }),
      jsonResponse({ id: 'result' }),
    );

    await apiFetch('/test', {}, false);

    expect(fetchMock.mock.calls).toHaveLength(1);
    expect(readAuthorization(fetchMock.mock.calls[0])).toBeUndefined();
  });

  it('keeps the pair and sends anyway when the renewal cannot be reached', async () => {
    const expired = makeTokenExpiringIn(-60);
    setStoredToken(expired, 'valid-refresh');

    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/auth/refresh')) {
        return Promise.reject(new TypeError('Failed to fetch'));
      }
      return Promise.resolve(jsonResponse({ id: 'result' }));
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(apiFetch<{ id: string }>('/test')).resolves.toEqual({
      id: 'result',
    });

    // a renewal that reached no verdict is no reason to end the session
    expect(getStoredToken()).toBe(expired);
    expect(getStoredRefreshToken()).toBe('valid-refresh');
    expect(fetchMock.mock.calls).toHaveLength(2);
    expect(readAuthorization(fetchMock.mock.calls[1])).toBe(
      `Bearer ${expired}`,
    );
  });

  it('keeps the token it holds when there is nothing to renew with', async () => {
    const expired = makeTokenExpiringIn(-60);
    setStoredToken(expired);
    const fetchMock = mockFetchByLeg(
      jsonResponse({ accessToken: 'renewed-jwt' }),
      jsonResponse({ id: 'result' }),
    );

    await expect(apiFetch<{ id: string }>('/test')).resolves.toEqual({
      id: 'result',
    });

    // a refusal reached without a leg is no verdict on the access token
    expect(readPaths(fetchMock)).toEqual(['/test']);
    expect(readAuthorization(fetchMock.mock.calls[0])).toBe(
      `Bearer ${expired}`,
    );
    expect(getStoredToken()).toBe(expired);
  });

  it('keeps the pair and sends the token it had when the renewal is refused with a 401', async () => {
    const expired = makeTokenExpiringIn(-60);
    setStoredToken(expired, 'spent-refresh');
    // the server still honours the access token this clock calls expired
    const fetchMock = mockFetchByLeg(
      jsonResponse({ message: 'Invalid refresh' }, 401),
      jsonResponse({ id: 'result' }),
    );

    await expect(apiFetch<{ id: string }>('/test')).resolves.toEqual({
      id: 'result',
    });

    const [renewalUrl] = fetchMock.mock.calls[0] as [string, RequestInit];
    const [requestUrl] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(renewalUrl).toContain('/auth/refresh');
    expect(requestUrl).toContain('/test');
    // a refused refresh token is no verdict on the access token
    expect(readAuthorization(fetchMock.mock.calls[1])).toBe(
      `Bearer ${expired}`,
    );
    expect(getStoredToken()).toBe(expired);
    expect(getStoredRefreshToken()).toBe('spent-refresh');
    expect(fetchMock.mock.calls).toHaveLength(2);
  });

  it('keeps the pair and sends the token it had when the renewal is refused with a 403', async () => {
    const expired = makeTokenExpiringIn(-60);
    setStoredToken(expired, 'spent-refresh');
    const fetchMock = mockFetchByLeg(
      jsonResponse({ message: 'Forbidden' }, 403),
      jsonResponse({ id: 'result' }),
    );

    await expect(apiFetch<{ id: string }>('/test')).resolves.toEqual({
      id: 'result',
    });

    expect(readAuthorization(fetchMock.mock.calls[1])).toBe(
      `Bearer ${expired}`,
    );
    expect(getStoredToken()).toBe(expired);
    expect(getStoredRefreshToken()).toBe('spent-refresh');
    expect(fetchMock.mock.calls).toHaveLength(2);
  });

  it('still ends a session the server does refuse, one leg later', async () => {
    setStoredToken(makeTokenExpiringIn(-60), 'spent-refresh');
    const fetchMock = mockFetchByLeg(
      jsonResponse({ message: 'Invalid refresh' }, 401),
      jsonResponse({ message: 'Unauthorized' }, 401),
    );

    const error = await apiFetch('/test').catch((caught: unknown) => caught);

    // refused renewal, refused request, then the 401 path's own refresh
    expect(readPaths(fetchMock)).toEqual([
      '/auth/refresh',
      '/test',
      '/auth/refresh',
    ]);
    expect((error as ApiError).status).toBe(401);
    // the request was refused too, so this one is a verdict: clear
    expect(getStoredToken()).toBeNull();
    expect(getStoredRefreshToken()).toBeNull();
  });

  it('stops after the one retry when the renewed token is rejected too', async () => {
    setStoredToken(makeTokenExpiringIn(-60), 'valid-refresh');
    const fetchMock = mockFetchByLeg(
      jsonResponse({
        accessToken: 'renewed-jwt',
        refreshToken: 'renewed-refresh',
      }),
      jsonResponse({ message: 'Unauthorized' }, 401),
    );

    const error = await apiFetch('/test').catch((caught: unknown) => caught);

    // renewal, request, the existing one-shot retry's renewal, retry
    expect(fetchMock.mock.calls).toHaveLength(4);
    expect((error as ApiError).status).toBe(401);
  });
});

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

  it('returns mfaToken and mfaMethod when MFA is required', async () => {
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

describe('resendEmailChangeVerification', () => {
  it('POSTs to /auth/resend-email-change with auth', async () => {
    setStoredToken('my-jwt');
    const fetchMock = mockFetch({});

    await resendEmailChangeVerification();

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/auth/resend-email-change');
    expect(options.method).toBe('POST');
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
    const fetchMock = mockFetch({
      accessToken: 'fresh-jwt',
      refreshToken: 'fresh-refresh',
    });

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

  it('stores the returned access and refresh tokens on the non-MFA branch', async () => {
    mockFetch({ accessToken: 'reset-jwt', refreshToken: 'reset-refresh' });

    await resetPassword('reset-token', 'newpass123');

    expect(getStoredToken()).toBe('reset-jwt');
    expect(getStoredRefreshToken()).toBe('reset-refresh');
  });

  it('does not store a token when the server returns an MFA challenge', async () => {
    mockFetch({ mfaToken: 'mfa-tok', mfaMethod: 'totp' });

    const result = await resetPassword('reset-token', 'newpass123');

    expect(getStoredToken()).toBeNull();
    expect(result).toEqual({ mfaToken: 'mfa-tok', mfaMethod: 'totp' });
  });
});

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

describe('setupTotp', () => {
  it('POSTs to /auth/mfa/totp/setup with auth', async () => {
    setStoredToken('my-jwt');
    const fetchMock = mockFetch({ qrCodeDataUrl: 'data:...', secret: 'ABC' });

    await setupTotp();

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/auth/mfa/totp/setup');
    expect((options as { method: string }).method).toBe('POST');
    const headers = (options as { headers: Record<string, string> }).headers;
    expect(headers['Authorization']).toBe('Bearer my-jwt');
  });
});

describe('verifyTotpSetup', () => {
  it('POSTs to /auth/mfa/totp/verify with the 6-digit code', async () => {
    setStoredToken('my-jwt');
    const fetchMock = mockFetch({ recoveryCodes: ['aaaaa-bbbbb'] });

    await verifyTotpSetup('123456');

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/auth/mfa/totp/verify');
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
  // verifyMagicLink returns tokens without storing; caller swaps sessions
  it('POSTs to /auth/verify-magic-link with token and returns the response without storing', async () => {
    const fetchMock = mockFetch({
      accessToken: 'ml-jwt',
      refreshToken: 'ml-refresh',
      userId: 'user-1',
    });

    const result = await verifyMagicLink('my-token');

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/auth/verify-magic-link');
    const body = JSON.parse((options as { body: string }).body) as {
      token: string;
    };
    expect(body.token).toBe('my-token');
    expect(result).toEqual({
      accessToken: 'ml-jwt',
      refreshToken: 'ml-refresh',
      userId: 'user-1',
    });
    expect(getStoredToken()).toBeNull();
  });

  // MFA accounts get a challenge back; return as-is so caller shows MfaView
  it('returns the mfa challenge unchanged and does not store any token', async () => {
    mockFetch({ mfaToken: 'pending-mfa-token', mfaMethod: 'totp' });

    const result = await verifyMagicLink('my-token');

    expect(result).toEqual({
      mfaToken: 'pending-mfa-token',
      mfaMethod: 'totp',
    });
    expect(getStoredToken()).toBeNull();
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

describe('setPassword', () => {
  it('POSTs to /auth/set-password with password in body', async () => {
    setStoredToken('my-jwt');
    const fetchMock = mockFetch({});

    await setPassword('new-secure-password');

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/auth/set-password');
    expect((options as { method: string }).method).toBe('POST');
    const body = JSON.parse((options as { body: string }).body) as {
      password: string;
    };
    expect(body.password).toBe('new-secure-password');
  });
});

describe('unlinkOAuthProvider', () => {
  it('DELETEs /auth/providers/:provider with auth header', async () => {
    setStoredToken('my-jwt');
    const fetchMock = mockFetch({});

    await unlinkOAuthProvider('google');

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/auth/providers/google');
    expect((options as { method: string }).method).toBe('DELETE');
    const headers = (options as { headers: Record<string, string> }).headers;
    expect(headers['Authorization']).toBe('Bearer my-jwt');
  });

  it('encodes special characters in the provider name', async () => {
    setStoredToken('my-jwt');
    const fetchMock = mockFetch({});

    await unlinkOAuthProvider('some provider');

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain('/auth/providers/some%20provider');
  });
});

describe('stumbleLink', () => {
  it('POSTs to /links/stumble with auth header', async () => {
    setStoredToken('my-jwt');
    const fetchMock = mockFetch({ url: 'https://example.com' });

    const result = await stumbleLink();

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/links/stumble');
    expect((options as { method: string }).method).toBe('POST');
    expect(result).toEqual({ url: 'https://example.com' });
  });

  it('returns null url when no unread links exist', async () => {
    setStoredToken('my-jwt');
    mockFetch({ url: null });

    const result = await stumbleLink();

    expect(result).toEqual({ url: null });
  });
});

describe('disableMfa', () => {
  it('DELETEs /auth/mfa with the provided credentials', async () => {
    setStoredToken('my-jwt');
    const fetchMock = mockFetch({});

    await disableMfa({ currentPassword: 'open-sesame' });

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/auth/mfa');
    expect((options as { method: string }).method).toBe('DELETE');
    const body = JSON.parse((options as { body: string }).body) as {
      currentPassword: string;
    };
    expect(body.currentPassword).toBe('open-sesame');
  });
});

describe('regenerateRecoveryCodes', () => {
  it('POSTs to /auth/mfa/recovery-codes/regenerate with credentials', async () => {
    setStoredToken('my-jwt');
    const fetchMock = mockFetch({ recoveryCodes: ['aaaaa-bbbbb'] });

    await regenerateRecoveryCodes({ currentPassword: 'open-sesame' });

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/auth/mfa/recovery-codes/regenerate');
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

describe('typed endpoints – ApiError guards on empty response body', () => {
  it('login throws ApiError when the server returns an empty body', async () => {
    mockFetchEmptyBody();
    await expect(login('a@b.co', 'pw')).rejects.toBeInstanceOf(ApiError);
  });

  it('verifyMagicLink throws ApiError when the server returns an empty body', async () => {
    mockFetchEmptyBody();
    await expect(verifyMagicLink('token')).rejects.toBeInstanceOf(ApiError);
  });

  it('verifyOtp throws ApiError when the server returns an empty body', async () => {
    mockFetchEmptyBody();
    await expect(verifyOtp('mfa', '123456', 'totp')).rejects.toBeInstanceOf(
      ApiError,
    );
  });

  it('getMe throws ApiError when the server returns an empty body', async () => {
    setStoredToken('my-jwt');
    mockFetchEmptyBody();
    await expect(getMe()).rejects.toBeInstanceOf(ApiError);
  });

  it('setupTotp throws ApiError when the server returns an empty body', async () => {
    setStoredToken('my-jwt');
    mockFetchEmptyBody();
    await expect(setupTotp()).rejects.toBeInstanceOf(ApiError);
  });

  it('verifyTotpSetup throws ApiError when the server returns an empty body', async () => {
    setStoredToken('my-jwt');
    mockFetchEmptyBody();
    await expect(verifyTotpSetup('123456')).rejects.toBeInstanceOf(ApiError);
  });

  it('regenerateRecoveryCodes throws ApiError when the server returns an empty body', async () => {
    setStoredToken('my-jwt');
    mockFetchEmptyBody();
    await expect(
      regenerateRecoveryCodes({ currentPassword: 'pw' }),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it('initiateOAuthLink throws ApiError when the server returns an empty body', async () => {
    setStoredToken('my-jwt');
    mockFetchEmptyBody();
    await expect(initiateOAuthLink('google')).rejects.toBeInstanceOf(ApiError);
  });
});
