import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '../../auth/AuthContext/types';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../../lib/api', () => ({
  getApiDocsToken: vi.fn(),
}));

vi.mock('../../auth/AuthContext', () => ({
  useAuth: vi.fn(),
}));

// ─── Imports after mocks ──────────────────────────────────────────────────────

import { getApiDocsToken } from '../../lib/api';
import { useAuth } from '../../auth/AuthContext';
import { useApiDocsToken } from './useApiDocsToken';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeUser(overrides: Partial<User> = {}): User {
  return {
    connectedProviders: [],
    cvdMode: false,
    email: 'current@example.com',
    emailVerifiedAt: '2024-01-01T00:00:00.000Z',
    hasPassword: true,
    pendingEmail: null,
    mode: 'light',
    theme: 'scanner-darkly',
    multiFactorMethod: null,
    multiFactorPending: false,
    accountDeletionPending: false,
    userId: 'user-1',
    welcomedAt: null,
    ...overrides,
  };
}

function mockAuth(overrides: { user?: User | null; loading?: boolean } = {}) {
  vi.mocked(useAuth).mockReturnValue({
    loading: false,
    login: vi.fn(),
    loginWithToken: vi.fn(),
    logout: vi.fn(),
    register: vi.fn(),
    resendVerificationEmail: vi.fn(),
    resendEmailChangeVerification: vi.fn(),
    setPendingEmail: vi.fn(),
    refreshUser: vi.fn(),
    markWelcomed: vi.fn(),
    user: makeUser(),
    ...overrides,
  });
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useApiDocsToken', () => {
  it('fetches and returns the raw token when the user is logged in', async () => {
    mockAuth({ user: makeUser() });
    vi.mocked(getApiDocsToken).mockResolvedValue({
      id: 'tok-docs',
      name: 'API Docs',
      prefix: 'ltk_aBcDeFgH',
      createdAt: '2026-01-01T00:00:00.000Z',
      lastUsedAt: null,
      rawToken: 'ltk_realtoken',
    });

    const { result } = renderHook(() => useApiDocsToken());

    await waitFor(() => expect(result.current.token).toBe('ltk_realtoken'));
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(getApiDocsToken).toHaveBeenCalledTimes(1);
  });

  it('returns an empty token and never calls the endpoint when logged out', async () => {
    mockAuth({ user: null });

    const { result } = renderHook(() => useApiDocsToken());

    expect(result.current.token).toBe('');
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(getApiDocsToken).not.toHaveBeenCalled();
  });

  it('defers the fetch while auth is still loading', () => {
    mockAuth({ user: null, loading: true });

    const { result } = renderHook(() => useApiDocsToken());

    expect(result.current.token).toBe('');
    expect(result.current.loading).toBe(true);
    expect(getApiDocsToken).not.toHaveBeenCalled();
  });

  it('surfaces a fetch failure through error', async () => {
    mockAuth({ user: makeUser() });
    vi.mocked(getApiDocsToken).mockRejectedValue(new Error('Network down'));

    const { result } = renderHook(() => useApiDocsToken());

    await waitFor(() => expect(result.current.error).toBe('Network down'));
    expect(result.current.token).toBe('');
    expect(result.current.loading).toBe(false);
  });

  it('does not set state when unmounted before the fetch resolves', async () => {
    mockAuth({ user: makeUser() });
    let resolveFetch: (value: {
      id: string;
      name: string;
      prefix: string;
      createdAt: string;
      lastUsedAt: string | null;
      rawToken: string;
    }) => void = () => {};
    vi.mocked(getApiDocsToken).mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
    );

    const { result, unmount } = renderHook(() => useApiDocsToken());
    unmount();

    resolveFetch({
      id: 'tok-docs',
      name: 'API Docs',
      prefix: 'ltk_aBcDeFgH',
      createdAt: '2026-01-01T00:00:00.000Z',
      lastUsedAt: null,
      rawToken: 'ltk_latetoken',
    });

    // Give the resolved promise a tick to flush; state must remain untouched.
    await Promise.resolve();
    expect(result.current.token).toBe('');
  });
});
