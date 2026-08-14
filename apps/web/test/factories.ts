/**
 * Shared shapes for tests that hand a whole server response to something.
 *
 * Hand-rolled object literals are what let the suite drift: a mock missing
 * a field the type requires, or carrying one the type dropped, compiles
 * fine as an anonymous object and only stops matching reality when
 * something reads the missing field. `multiFactorMethod` narrowed from
 * `'totp' | 'email' | null` to `'totp' | null` and several mocks kept the
 * wider union for months.
 *
 * Typed as the response itself rather than a partial of it, so a field
 * added to the wire shape breaks here once instead of in every caller.
 * Overrides spread last and are typed `Partial`, which is what keeps a
 * test free to say only the thing it cares about.
 */

import { vi } from 'vitest';
import type { AuthContextValue, User } from '../src/auth/AuthContext/types';
import type { LoginResponse, MeResponse } from '../src/lib/api';

export function makeMeResponse(overrides: Partial<MeResponse> = {}): MeResponse {
  return {
    accountDeletionPending: false,
    connectedProviders: [],
    customTheme: null,
    customThemeEnabled: false,
    cvdMode: false,
    dyslexicFont: false,
    email: 'user@example.com',
    emailVerifiedAt: '2024-01-01T00:00:00Z',
    hasPassword: true,
    mode: 'dark',
    multiFactorMethod: null,
    multiFactorPending: false,
    pendingEmail: null,
    theme: 'scanner-darkly',
    userId: 'user-1',
    welcomedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

/**
 * The signed-in branch of the login union. The MFA branch is a different
 * shape rather than a variation on this one, so a test that wants it
 * writes it out and says so.
 */
export function makeLoginResponse(
  overrides: Partial<{ accessToken: string; refreshToken: string }> = {},
): LoginResponse {
  return {
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    ...overrides,
  };
}

export function makeUser(overrides: Partial<User> = {}): User {
  return {
    accountDeletionPending: false,
    connectedProviders: [],
    customTheme: null,
    customThemeEnabled: false,
    cvdMode: false,
    dyslexicFont: false,
    email: 'user@example.com',
    emailVerifiedAt: '2024-01-01T00:00:00Z',
    hasPassword: true,
    mode: 'dark',
    multiFactorMethod: null,
    multiFactorPending: false,
    pendingEmail: null,
    theme: 'scanner-darkly',
    userId: 'user-1',
    welcomedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

/**
 * The whole `useAuth()` value. Eight suites each grew their own version of
 * this, every one of them a partial object typed as whatever it happened
 * to contain, which is how `markWelcomed` came to be missing from most of
 * them and `multiFactorMethod` kept a member the type had dropped.
 *
 * Every action is a `vi.fn()` with a real implementation, so a test can
 * assert on one it never mentioned and a test that cares passes its own
 * spy through the overrides. Signed out by default: `user` is what most
 * callers are really setting, so a null default makes them say when they
 * mean somebody.
 */
export function makeAuthContext(
  overrides: Partial<AuthContextValue> = {},
): AuthContextValue {
  return {
    loading: false,
    login: vi.fn(async () => undefined),
    loginWithToken: vi.fn(async () => undefined),
    logout: vi.fn(() => undefined),
    markWelcomed: vi.fn(async () => undefined),
    refreshUser: vi.fn(async () => undefined),
    register: vi.fn(async () => undefined),
    resendEmailChangeVerification: vi.fn(async () => undefined),
    resendVerificationEmail: vi.fn(async () => undefined),
    setPendingEmail: vi.fn(() => undefined),
    user: null,
    ...overrides,
  };
}
