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
  register: vi.fn(),
  resendEmailChangeVerification: vi.fn(),
  resendVerificationEmail: vi.fn(),
  setStoredToken: vi.fn(),
}));

import * as apiModule from '../../lib/api';
import { useAuthState } from './useAuthState';

const makeUser = (
  overrides: Partial<{
    pendingEmail: string | null;
    welcomedAt: string | null;
  }> = {},
) => ({
  cvdMode: false,
  connectedProviders: [],
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
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('initial state — no stored token', () => {
  it('sets loading to false and user to null when no token is stored', async () => {
    vi.mocked(apiModule.getStoredToken).mockReturnValue(null);

    const { result } = renderHook(() => useAuthState());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.user).toBeNull();
  });
});

describe('initial state — stored token present', () => {
  it('populates user from the stored token on mount', async () => {
    vi.mocked(apiModule.getStoredToken).mockReturnValue('stored-jwt');
    vi.mocked(apiModule.getMe).mockResolvedValue(makeUser());

    const { result } = renderHook(() => useAuthState());

    await waitFor(() => {
      expect(result.current.user?.email).toBe('user@example.com');
    });

    expect(result.current.loading).toBe(false);
  });

  it('clears the token and sets user to null when getMe fails', async () => {
    vi.mocked(apiModule.getStoredToken).mockReturnValue('expired-jwt');
    vi.mocked(apiModule.getMe).mockRejectedValue(new Error('Unauthorized'));

    const { result } = renderHook(() => useAuthState());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(apiModule.clearStoredToken).toHaveBeenCalled();
    expect(result.current.user).toBeNull();
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
