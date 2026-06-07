/**
 * Tests for VerifyLoginPage.
 *
 * On mount, reads ?token= from the URL and calls verifyMagicLink().
 * State machine: verifying → success (navigate /unread) | error | mfa (MfaView)
 */

import VerifyLoginPage from './VerifyLoginPage';
import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../../lib/api', () => ({
  verifyMagicLink: vi.fn(),
  verifyOtp: vi.fn(),
}));

vi.mock('../../auth/AuthContext', () => ({
  useAuth: vi.fn(),
}));

const navigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual =
    await vi.importActual<typeof import('react-router-dom')>(
      'react-router-dom',
    );
  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

// ─── Imports after mocks ──────────────────────────────────────────────────────

import * as apiModule from '../../lib/api';
import { useAuth } from '../../auth/AuthContext';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeAuthContext(
  overrides: Partial<{
    loginWithToken: ReturnType<typeof vi.fn>;
    refreshUser: ReturnType<typeof vi.fn>;
  }> = {},
) {
  return {
    loading: false,
    login: vi.fn(),
    loginWithToken: vi.fn().mockResolvedValue(undefined),
    logout: vi.fn(),
    register: vi.fn(),
    refreshUser: vi.fn().mockResolvedValue(undefined),
    resendVerificationEmail: vi.fn(),
    setPendingEmail: vi.fn(),
    markWelcomed: vi.fn(),
    user: null,
    ...overrides,
  };
}

function renderPage(search = '?token=valid-token') {
  return render(
    <MemoryRouter initialEntries={[`/verify-login${search}`]}>
      <VerifyLoginPage />
    </MemoryRouter>,
  );
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useAuth).mockReturnValue(makeAuthContext());
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('VerifyLoginPage loading state', () => {
  it('shows a verifying status message while the API call is pending', () => {
    vi.mocked(apiModule.verifyMagicLink).mockReturnValue(new Promise(() => {}));

    renderPage();

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText(/verifying your login link/i)).toBeInTheDocument();
  });
});

describe('VerifyLoginPage success path', () => {
  it('calls verifyMagicLink with the token from the URL', async () => {
    vi.mocked(apiModule.verifyMagicLink).mockResolvedValue({
      accessToken: 'jwt-abc',
      refreshToken: 'refresh-abc',
    });

    await act(async () => {
      renderPage('?token=my-magic-token');
    });

    await waitFor(() => {
      expect(apiModule.verifyMagicLink).toHaveBeenCalledWith('my-magic-token');
    });
  });

  it('calls loginWithToken with the access and refresh tokens on success', async () => {
    const loginWithToken = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useAuth).mockReturnValue(makeAuthContext({ loginWithToken }));
    vi.mocked(apiModule.verifyMagicLink).mockResolvedValue({
      accessToken: 'jwt-abc',
      refreshToken: 'refresh-abc',
    });

    await act(async () => {
      renderPage();
    });

    await waitFor(() => {
      expect(loginWithToken).toHaveBeenCalledWith('jwt-abc', 'refresh-abc');
    });
  });

  it('navigates to /unread after successful verification', async () => {
    vi.mocked(apiModule.verifyMagicLink).mockResolvedValue({
      accessToken: 'jwt-abc',
      refreshToken: 'refresh-abc',
    });

    await act(async () => {
      renderPage();
    });

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith('/unread', { replace: true });
    });
  });
});

describe('VerifyLoginPage error paths', () => {
  it('shows an error when no token is in the URL', async () => {
    await act(async () => {
      renderPage('');
    });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    expect(apiModule.verifyMagicLink).not.toHaveBeenCalled();
  });

  it('shows an error when verifyMagicLink rejects', async () => {
    vi.mocked(apiModule.verifyMagicLink).mockRejectedValue(
      new Error('Link expired'),
    );

    await act(async () => {
      renderPage();
    });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('shows error message text when the API rejects with an Error', async () => {
    vi.mocked(apiModule.verifyMagicLink).mockRejectedValue(
      new Error('Link already used'),
    );

    await act(async () => {
      renderPage();
    });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/link already used/i);
    });
  });
});

describe('VerifyLoginPage MFA challenge', () => {
  it('shows MfaView when verifyMagicLink returns an mfaToken', async () => {
    vi.mocked(apiModule.verifyMagicLink).mockResolvedValue({
      mfaToken: 'mfa-tok-123',
      mfaMethod: 'totp',
    });

    await act(async () => {
      renderPage();
    });

    await waitFor(() => {
      // MfaView renders a TOTP input
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });
  });
});
