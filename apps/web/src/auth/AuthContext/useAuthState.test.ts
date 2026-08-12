/**
 * Direct tests for the useAuthState hook.
 *
 * AuthContext.test.tsx covers end-to-end provider behavior through the
 * AuthConsumer + AuthProvider tree. These tests target useAuthState in
 * isolation to give the hook direct coverage, satisfying the test_coverage
 * detector which only counts direct imports.
 *
 * All API calls are mocked at the module boundary.
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/api', () => ({
  acknowledgeWelcome: vi.fn(),
  clearStoredToken: vi.fn(),
  getMe: vi.fn(),
  getStoredToken: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  readTokenClaims: vi.fn(),
  register: vi.fn(),
  resendEmailChangeVerification: vi.fn(),
  resendVerificationEmail: vi.fn(),
  setStoredToken: vi.fn(),
}));

import * as apiModule from '../../lib/api';
import { hasCarriedEmail } from './carriedEmail';
import { readRenderedIdentity } from './renderedIdentity';
import { restoreLocation, standOnPath } from '../../../test/locationMock';
import { useAuthState } from './useAuthState';

const makeUser = (
  overrides: Partial<{
    pendingEmail: string | null;
    welcomedAt: string | null;
    customTheme: unknown;
    dyslexicFont: boolean;
  }> = {},
) => ({
  cvdMode: false,
  dyslexicFont: false,
  connectedProviders: [],
  customTheme: null as unknown,
  email: 'user@example.com',
  emailVerifiedAt: '2024-01-01T00:00:00Z',
  hasPassword: true,
  mode: 'dark',
  pendingEmail: null,
  theme: 'scanner-darkly',
  multiFactorMethod: null as 'totp' | 'email' | null,
  multiFactorPending: false,
  userId: 'user-1',
  welcomedAt: '2024-01-01T00:00:00Z' as string | null,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  vi.mocked(apiModule.readTokenClaims).mockReturnValue(null);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('initial state – no stored token', () => {
  it('sets loading to false and user to null when no token is stored', async () => {
    vi.mocked(apiModule.getStoredToken).mockReturnValue(null);

    const { result } = renderHook(() => useAuthState());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.user).toBeNull();
  });
});

describe('initial state – stored token present', () => {
  it('populates user from the stored token on mount', async () => {
    vi.mocked(apiModule.getStoredToken).mockReturnValue('stored-jwt');
    vi.mocked(apiModule.getMe).mockResolvedValue(makeUser());

    const { result } = renderHook(() => useAuthState());

    await waitFor(() => {
      expect(result.current.user?.email).toBe('user@example.com');
    });

    expect(result.current.loading).toBe(false);
  });

  it.each([
    ['a network error', new TypeError('Failed to fetch')],
    [
      'a 5xx server fault',
      Object.assign(new Error('Bad gateway'), {
        name: 'ApiError',
        status: 502,
      }),
    ],
  ])(
    'keeps the stored token when hydration fails with %s',
    async (_description, failure) => {
      vi.mocked(apiModule.getStoredToken).mockReturnValue('stored-jwt');
      vi.mocked(apiModule.getMe).mockRejectedValue(failure);

      const { result } = renderHook(() => useAuthState());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // a transient getMe fault keeps the session; only a 401 clears it
      expect(apiModule.clearStoredToken).not.toHaveBeenCalled();
      expect(result.current.user).toBeNull();
    },
  );

  it('lands logged out when the session is genuinely dead', async () => {
    // core clears the token on the failed getMe, so the visitor lands logged out
    vi.mocked(apiModule.getStoredToken)
      .mockReturnValueOnce('expired-jwt')
      .mockReturnValue(null);
    vi.mocked(apiModule.getMe).mockRejectedValue(
      Object.assign(new Error('Unauthorized'), {
        name: 'ApiError',
        status: 401,
      }),
    );

    const { result } = renderHook(() => useAuthState());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.user).toBeNull();
  });

  it('recovers on a later hydration after a transient mount failure', async () => {
    vi.mocked(apiModule.getStoredToken).mockReturnValue('stored-jwt');
    vi.mocked(apiModule.getMe)
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValue(makeUser());

    const { result } = renderHook(() => useAuthState());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.user).toBeNull();
    expect(apiModule.clearStoredToken).not.toHaveBeenCalled();

    // the surviving token lets the next hydration succeed
    await act(async () => {
      await result.current.refreshUser();
    });

    expect(result.current.user?.email).toBe('user@example.com');
  });
});

describe('login', () => {
  it('populates user state after a successful login', async () => {
    vi.mocked(apiModule.getStoredToken).mockReturnValue(null);
    vi.mocked(apiModule.login).mockResolvedValue({ accessToken: 'new-jwt' });
    vi.mocked(apiModule.getMe).mockResolvedValue(makeUser());

    const { result } = renderHook(() => useAuthState());

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.login('user@example.com', 'pass');
    });

    expect(result.current.user?.email).toBe('user@example.com');
  });

  it('returns mfaToken and mfaMethod when MFA is required', async () => {
    vi.mocked(apiModule.getStoredToken).mockReturnValue(null);
    vi.mocked(apiModule.login).mockResolvedValue({
      mfaToken: 'mfa-tok',
      mfaMethod: 'totp',
    });

    const { result } = renderHook(() => useAuthState());

    await waitFor(() => expect(result.current.loading).toBe(false));

    let mfaResult: { mfaToken: string; mfaMethod: 'totp' } | void;

    await act(async () => {
      mfaResult = await result.current.login('user@example.com', 'pass');
    });

    expect(mfaResult).toEqual({ mfaToken: 'mfa-tok', mfaMethod: 'totp' });
    expect(result.current.user).toBeNull();
    expect(apiModule.getMe).not.toHaveBeenCalled();
  });
});

describe('loginWithToken', () => {
  it('stores the token, fetches the user, and populates user state', async () => {
    vi.mocked(apiModule.getStoredToken).mockReturnValue(null);
    vi.mocked(apiModule.setStoredToken).mockImplementation(() => undefined);
    vi.mocked(apiModule.getMe).mockResolvedValue(makeUser());

    const { result } = renderHook(() => useAuthState());

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.loginWithToken('oauth-jwt');
    });

    expect(apiModule.setStoredToken).toHaveBeenCalledWith(
      'oauth-jwt',
      undefined,
    );
    expect(result.current.user?.email).toBe('user@example.com');
  });

  it('forwards rememberMe=true to setStoredToken', async () => {
    vi.mocked(apiModule.getStoredToken).mockReturnValue(null);
    vi.mocked(apiModule.setStoredToken).mockImplementation(() => undefined);
    vi.mocked(apiModule.getMe).mockResolvedValue(makeUser());

    const { result } = renderHook(() => useAuthState());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.loginWithToken('oauth-jwt', true);
    });

    expect(apiModule.setStoredToken).toHaveBeenCalledWith('oauth-jwt', true);
  });

  it('forwards rememberMe=false to setStoredToken', async () => {
    vi.mocked(apiModule.getStoredToken).mockReturnValue(null);
    vi.mocked(apiModule.setStoredToken).mockImplementation(() => undefined);
    vi.mocked(apiModule.getMe).mockResolvedValue(makeUser());

    const { result } = renderHook(() => useAuthState());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.loginWithToken('oauth-jwt', false);
    });

    expect(apiModule.setStoredToken).toHaveBeenCalledWith('oauth-jwt', false);
  });
});

describe('logout', () => {
  it('clears user state and calls apiLogout', async () => {
    vi.mocked(apiModule.getStoredToken).mockReturnValue('stored-jwt');
    vi.mocked(apiModule.getMe).mockResolvedValue(makeUser());

    const { result } = renderHook(() => useAuthState());

    await waitFor(() =>
      expect(result.current.user?.email).toBe('user@example.com'),
    );

    act(() => {
      result.current.logout();
    });

    expect(apiModule.logout).toHaveBeenCalled();
    expect(result.current.user).toBeNull();
  });
});

describe('register', () => {
  it('calls apiRegister then logs in automatically', async () => {
    vi.mocked(apiModule.getStoredToken).mockReturnValue(null);
    vi.mocked(apiModule.register).mockResolvedValue(undefined);
    vi.mocked(apiModule.login).mockResolvedValue({ accessToken: 'jwt' });
    vi.mocked(apiModule.getMe).mockResolvedValue(makeUser());

    const { result } = renderHook(() => useAuthState());

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.register('user@example.com', 'pass');
    });

    expect(apiModule.register).toHaveBeenCalledWith('user@example.com', 'pass');
    expect(result.current.user?.email).toBe('user@example.com');
  });
});

describe('setPendingEmail', () => {
  it('updates pendingEmail optimistically without a refetch', async () => {
    vi.mocked(apiModule.getStoredToken).mockReturnValue('stored-jwt');
    vi.mocked(apiModule.getMe).mockResolvedValue(makeUser());

    const { result } = renderHook(() => useAuthState());

    await waitFor(() =>
      expect(result.current.user?.email).toBe('user@example.com'),
    );

    act(() => {
      result.current.setPendingEmail('new@example.com');
    });

    expect(result.current.user?.pendingEmail).toBe('new@example.com');
    expect(apiModule.getMe).toHaveBeenCalledTimes(1);
  });

  it('is a no-op when user is null', async () => {
    vi.mocked(apiModule.getStoredToken).mockReturnValue(null);

    const { result } = renderHook(() => useAuthState());

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.setPendingEmail('new@example.com');
    });

    expect(result.current.user).toBeNull();
  });
});

describe('refreshUser', () => {
  it('re-fetches the user profile and updates auth state', async () => {
    vi.mocked(apiModule.getStoredToken).mockReturnValue('stored-jwt');
    vi.mocked(apiModule.getMe)
      .mockResolvedValueOnce(makeUser())
      .mockResolvedValueOnce({ ...makeUser(), email: 'refreshed@example.com' });

    const { result } = renderHook(() => useAuthState());

    await waitFor(() =>
      expect(result.current.user?.email).toBe('user@example.com'),
    );

    await act(async () => {
      await result.current.refreshUser();
    });

    expect(result.current.user?.email).toBe('refreshed@example.com');
  });

  it('logs an error and leaves state unchanged when getMe fails', async () => {
    vi.mocked(apiModule.getStoredToken).mockReturnValue('stored-jwt');
    vi.mocked(apiModule.getMe)
      .mockResolvedValueOnce(makeUser())
      .mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useAuthState());

    await waitFor(() =>
      expect(result.current.user?.email).toBe('user@example.com'),
    );

    await act(async () => {
      await result.current.refreshUser();
    });

    expect(console.error).toHaveBeenCalledWith(
      'Failed to refresh user',
      expect.any(Error),
    );
    expect(result.current.user?.email).toBe('user@example.com');
  });
});

describe('markWelcomed', () => {
  it('optimistically sets welcomedAt and calls the welcome endpoint', async () => {
    vi.mocked(apiModule.getStoredToken).mockReturnValue('stored-jwt');
    vi.mocked(apiModule.getMe).mockResolvedValue(
      makeUser({ welcomedAt: null }),
    );
    vi.mocked(apiModule.acknowledgeWelcome).mockResolvedValue(undefined);

    const { result } = renderHook(() => useAuthState());

    await waitFor(() => expect(result.current.user?.welcomedAt).toBeNull());

    await act(async () => {
      await result.current.markWelcomed();
    });

    expect(apiModule.acknowledgeWelcome).toHaveBeenCalled();
    expect(result.current.user?.welcomedAt).not.toBeNull();
  });

  it('swallows API errors and still updates welcomedAt optimistically', async () => {
    vi.mocked(apiModule.getStoredToken).mockReturnValue('stored-jwt');
    vi.mocked(apiModule.getMe).mockResolvedValue(
      makeUser({ welcomedAt: null }),
    );
    vi.mocked(apiModule.acknowledgeWelcome).mockRejectedValue(
      new Error('Network error'),
    );

    const { result } = renderHook(() => useAuthState());

    await waitFor(() => expect(result.current.user?.welcomedAt).toBeNull());

    await act(async () => {
      await result.current.markWelcomed();
    });

    expect(console.error).toHaveBeenCalledWith(
      'Failed to acknowledge welcome',
      expect.any(Error),
    );
    expect(result.current.user?.welcomedAt).not.toBeNull();
  });
});

describe('a getMe that lands after the user signed out', () => {
  /** Hands back the promise `getMe` is stuck on, plus its resolver. */
  function deferGetMe() {
    let release!: (me: ReturnType<typeof makeUser>) => void;
    vi.mocked(apiModule.getMe).mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve as (me: ReturnType<typeof makeUser>) => void;
        }),
    );
    return () => release(makeUser());
  }

  it('is discarded rather than throwing the user back into the app', async () => {
    vi.mocked(apiModule.getStoredToken).mockReturnValue(null);
    const releaseGetMe = deferGetMe();

    const { result } = renderHook(() => useAuthState());
    await waitFor(() => expect(result.current.loading).toBe(false));

    let refresh!: Promise<void>;
    act(() => {
      refresh = result.current.refreshUser();
    });
    act(() => {
      result.current.logout();
    });
    await act(async () => {
      releaseGetMe();
      await refresh;
    });

    expect(result.current.user).toBeNull();
  });

  it('is adopted normally when no sign-out interrupts it', async () => {
    vi.mocked(apiModule.getStoredToken).mockReturnValue(null);
    const releaseGetMe = deferGetMe();

    const { result } = renderHook(() => useAuthState());
    await waitFor(() => expect(result.current.loading).toBe(false));

    let refresh!: Promise<void>;
    act(() => {
      refresh = result.current.refreshUser();
    });
    await act(async () => {
      releaseGetMe();
      await refresh;
    });

    expect(result.current.user?.email).toBe('user@example.com');
  });
});

describe('recording who this tab is rendering', () => {
  it('notes the identity on mount hydration', async () => {
    vi.mocked(apiModule.getStoredToken).mockReturnValue('stored-jwt');
    vi.mocked(apiModule.getMe).mockResolvedValue(makeUser());

    const { result } = renderHook(() => useAuthState());
    await waitFor(() => expect(result.current.user).not.toBeNull());

    expect(readRenderedIdentity()).toBe('user-1');
  });

  it('notes the identity after a login', async () => {
    vi.mocked(apiModule.getStoredToken).mockReturnValue(null);
    vi.mocked(apiModule.login).mockResolvedValue({ accessToken: 'jwt' });
    vi.mocked(apiModule.getMe).mockResolvedValue(makeUser());

    const { result } = renderHook(() => useAuthState());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.login('user@example.com', 'pass');
    });

    expect(readRenderedIdentity()).toBe('user-1');
  });

  it('forgets it on logout, because a signed-out tab renders nobody', async () => {
    vi.mocked(apiModule.getStoredToken).mockReturnValue('stored-jwt');
    vi.mocked(apiModule.getMe).mockResolvedValue(makeUser());

    const { result } = renderHook(() => useAuthState());
    await waitFor(() => expect(readRenderedIdentity()).toBe('user-1'));

    act(() => {
      result.current.logout();
    });

    expect(readRenderedIdentity()).toBeNull();
  });
});

describe('an offer whose link landed', () => {
  /**
   * The email is handed across the offer's document load in case the load
   * bounces. Rendering a user is the proof it did not, and the value has
   * to go then: left behind it prefills a form the user reaches later by
   * signing out, and arms an explanation for a bounce that never happened.
   */
  it('drops the carried email once a user is rendered', async () => {
    sessionStorage.setItem('linklater_carried_email', 'half-typed@test.com');
    vi.mocked(apiModule.getStoredToken).mockReturnValue('stored-jwt');
    vi.mocked(apiModule.getMe).mockResolvedValue(makeUser());

    const { result } = renderHook(() => useAuthState());
    await waitFor(() => expect(result.current.user).not.toBeNull());

    expect(hasCarriedEmail()).toBe(false);
  });

  it('leaves it alone while the boot is still failing to render anyone', async () => {
    sessionStorage.setItem('linklater_carried_email', 'half-typed@test.com');
    vi.mocked(apiModule.getStoredToken).mockReturnValue('stored-jwt');
    vi.mocked(apiModule.getMe).mockRejectedValue(new Error('network'));

    const { result } = renderHook(() => useAuthState());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(hasCarriedEmail()).toBe(true);
  });
});

describe('booting on a token that belongs to somebody else', () => {
  afterEach(() => {
    restoreLocation();
  });

  it('abandons the boot it was about to run, rather than fetching as them', async () => {
    const assignMock = standOnPath('/settings');
    sessionStorage.setItem('linklater_rendered_identity', 'user-1');
    vi.mocked(apiModule.getStoredToken).mockReturnValue('their-jwt');
    vi.mocked(apiModule.readTokenClaims).mockReturnValue({
      exp: null,
      subject: 'user-2',
    });

    renderHook(() => useAuthState());

    await waitFor(() => expect(assignMock).toHaveBeenCalledWith('/unread'));
    expect(apiModule.getMe).not.toHaveBeenCalled();
  });

  it('boots normally when the token belongs to the last rendered user', async () => {
    const assignMock = standOnPath('/settings');
    sessionStorage.setItem('linklater_rendered_identity', 'user-1');
    vi.mocked(apiModule.getStoredToken).mockReturnValue('same-jwt');
    vi.mocked(apiModule.readTokenClaims).mockReturnValue({
      exp: null,
      subject: 'user-1',
    });
    vi.mocked(apiModule.getMe).mockResolvedValue(makeUser());

    const { result } = renderHook(() => useAuthState());

    await waitFor(() =>
      expect(result.current.user?.email).toBe('user@example.com'),
    );
    expect(assignMock).not.toHaveBeenCalled();
  });
});

describe('the mirror the identity guard reads the rendered user through', () => {
  afterEach(() => {
    restoreLocation();
  });

  // the guard's own tests set .current by hand and cannot see this wire
  it('is fed, so a switch spotted on return to the tab is acted on', async () => {
    const assignMock = standOnPath('/settings');
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
    vi.mocked(apiModule.getStoredToken).mockReturnValue('stored-jwt');
    vi.mocked(apiModule.readTokenClaims).mockReturnValue({
      exp: null,
      subject: 'user-1',
    });
    vi.mocked(apiModule.getMe).mockResolvedValue(makeUser());

    const { result } = renderHook(() => useAuthState());
    await waitFor(() => expect(result.current.user?.userId).toBe('user-1'));

    vi.mocked(apiModule.readTokenClaims).mockReturnValue({
      exp: null,
      subject: 'user-2',
    });
    document.dispatchEvent(new Event('visibilitychange'));

    expect(assignMock).toHaveBeenCalledWith('/unread');
  });
});
