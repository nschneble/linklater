/**
 * Integration reproduction for the logged-out branding-paint defect.
 *
 * The direct `useThemeState(false)` hook tests prove the branding gate in
 * isolation. They do NOT prove the runtime behavior through the full provider
 * stack (AuthProvider → ThemeProvider → useThemeState), where `isAuthenticated`
 * is derived from live `GET /auth/me` hydration rather than a literal boolean.
 * These tests drive the real stack and assert the painted `data-theme` on
 * `document.documentElement`, which is what a logged-out visitor actually sees.
 */

import { act, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/api', () => ({
  acknowledgeWelcome: vi.fn(),
  clearStoredToken: vi.fn(),
  getMe: vi.fn(),
  getStoredToken: vi.fn(),
  login: vi.fn(),
  loginWithToken: vi.fn(),
  logout: vi.fn(),
  register: vi.fn(),
  resendEmailChangeVerification: vi.fn(),
  resendVerificationEmail: vi.fn(),
  setStoredToken: vi.fn(),
}));

import * as apiModule from '../../lib/api';
import { AuthProvider, useAuth } from '../../auth/AuthContext';
import { THEME_STORAGE_KEY } from '../storage';
import { ThemeProvider } from './index';

const makeMe = (
  overrides: Partial<{
    theme: string;
    mode: string;
    customTheme: unknown;
  }> = {},
) => ({
  cvdMode: false,
  connectedProviders: [],
  customTheme: null as unknown,
  customThemeEnabled: false,
  email: 'user@example.com',
  emailVerifiedAt: '2024-01-01T00:00:00Z',
  hasPassword: true,
  mode: 'dark',
  pendingEmail: null,
  theme: 'school-of-rock',
  multiFactorMethod: null as 'totp' | null,
  multiFactorPending: false,
  accountDeletionPending: false,
  userId: 'user-1',
  welcomedAt: '2024-01-01T00:00:00Z' as string | null,
  ...overrides,
});

/** Exposes the auth `logout` action so a test can trigger it via a click. */
function LogoutTrigger() {
  const { logout } = useAuth();
  return (
    <button type="button" data-testid="logout" onClick={() => logout()}>
      log out
    </button>
  );
}

function Stack() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <LogoutTrigger />
      </ThemeProvider>
    </AuthProvider>
  );
}

const paintedTheme = () => document.documentElement.dataset.theme;

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.removeAttribute('data-mode');
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('logged-out branding paint (full provider stack)', () => {
  it('repro #1: painting flips to branding after logout from a film theme', async () => {
    // Authenticated on load, stored film theme.
    window.localStorage.setItem(THEME_STORAGE_KEY, 'school-of-rock');
    vi.mocked(apiModule.getStoredToken).mockReturnValue('stored-jwt');
    vi.mocked(apiModule.getMe).mockResolvedValue(makeMe());

    const { getByTestId } = render(<Stack />);

    // Session hydrates → the user's film theme paints.
    await waitFor(() => {
      expect(paintedTheme()).toBe('school-of-rock');
    });

    // Log out → the auth surfaces must repaint to the off-book branding chrome.
    await act(async () => {
      getByTestId('logout').click();
    });

    expect(paintedTheme()).toBe('branding');
  });

  it('repro #2: a fresh logged-out load paints branding, never the stored film theme', async () => {
    // Logged out (no token), but a stale film selection lingers in storage.
    window.localStorage.setItem(THEME_STORAGE_KEY, 'school-of-rock');
    vi.mocked(apiModule.getStoredToken).mockReturnValue(null);

    render(<Stack />);

    // The painted theme must be branding from the very first commit and stay
    // branding once the (no-op) auth check settles — never school-of-rock.
    await waitFor(() => {
      expect(paintedTheme()).toBe('branding');
    });
    expect(paintedTheme()).not.toBe('school-of-rock');
  });

  it('repro #2b: a stale JWT that still resolves must NOT be treated as logged out', async () => {
    // A stateless JWT survives a server DB wipe: GET /auth/me still resolves,
    // so the visitor IS authenticated and their film theme is correct. This
    // pins the boundary so a branding fix does not over-reach into authed views.
    window.localStorage.setItem(THEME_STORAGE_KEY, 'school-of-rock');
    vi.mocked(apiModule.getStoredToken).mockReturnValue('stale-jwt');
    vi.mocked(apiModule.getMe).mockResolvedValue(makeMe());

    render(<Stack />);

    await waitFor(() => {
      expect(paintedTheme()).toBe('school-of-rock');
    });
  });
});
