/**
 * Tests for VerifyLoginPage.
 *
 * On mount, reads ?token= from the URL and calls verifyMagicLink().
 * State machine:
 *   - verifying → success → navigate('/unread') (NO toast — login is login)
 *   - verifying → MFA → MfaView mounted
 *   - verifying → failure → setPendingNotice('login-link-invalid') +
 *     navigate('/login') (AuthForm surfaces the toast)
 *
 * Per Wave 7: no error card is rendered anymore. All verify-link failures
 * redirect to /login with an error-variant pending notice. The MFA branch
 * is unchanged and still mounts MfaView for OTP entry.
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

vi.mock('../../lib/pendingNotice', () => ({
  setPendingNotice: vi.fn(),
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
import * as pendingNoticeModule from '../../lib/pendingNotice';
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

describe('VerifyLoginPage verifying state', () => {
  it('renders a polite sr-only status message while verifying', () => {
    vi.mocked(apiModule.verifyMagicLink).mockReturnValue(new Promise(() => {}));

    renderPage();

    const status = screen.getByRole('status');
    expect(status).toBeInTheDocument();
    expect(status).toHaveTextContent(/verifying your login link/i);
    // The status node carries `sr-only` — verifying state is visually a bare
    // spinner. No card heading is rendered (errors redirect to /login).
    expect(status).toHaveClass('sr-only');
  });

  it('does not render the legacy "Logging in" card heading', () => {
    vi.mocked(apiModule.verifyMagicLink).mockReturnValue(new Promise(() => {}));

    renderPage();

    expect(
      screen.queryByRole('heading', { name: /logging in/i }),
    ).not.toBeInTheDocument();
  });
});

describe('VerifyLoginPage success path (no toast — login is login)', () => {
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

  it('navigates to /unread with replace:true after successful verification', async () => {
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

  it('does NOT queue a pending notice on success (magic-link login is just login)', async () => {
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

    expect(pendingNoticeModule.setPendingNotice).not.toHaveBeenCalled();
  });
});

describe('VerifyLoginPage error paths — redirect to /login with toast', () => {
  it('queues login-link-invalid + navigates to /login when no token is present', async () => {
    await act(async () => {
      renderPage('');
    });

    await waitFor(() => {
      expect(pendingNoticeModule.setPendingNotice).toHaveBeenCalledWith(
        'login-link-invalid',
      );
    });
    expect(navigate).toHaveBeenCalledWith('/login', { replace: true });
    expect(apiModule.verifyMagicLink).not.toHaveBeenCalled();
  });

  it('queues login-link-invalid + navigates to /login when verifyMagicLink rejects', async () => {
    vi.mocked(apiModule.verifyMagicLink).mockRejectedValue(
      new Error('Link expired'),
    );

    await act(async () => {
      renderPage();
    });

    await waitFor(() => {
      expect(pendingNoticeModule.setPendingNotice).toHaveBeenCalledWith(
        'login-link-invalid',
      );
    });
    expect(navigate).toHaveBeenCalledWith('/login', { replace: true });
  });

  it('queues login-link-invalid + navigates to /login even when a non-Error is thrown', async () => {
    vi.mocked(apiModule.verifyMagicLink).mockRejectedValue('boom');

    await act(async () => {
      renderPage();
    });

    await waitFor(() => {
      expect(pendingNoticeModule.setPendingNotice).toHaveBeenCalledWith(
        'login-link-invalid',
      );
    });
    expect(navigate).toHaveBeenCalledWith('/login', { replace: true });
  });

  it('does not render the legacy error card (no alert role, no AuthErrorPanel)', async () => {
    vi.mocked(apiModule.verifyMagicLink).mockRejectedValue(
      new Error('Link expired'),
    );

    await act(async () => {
      renderPage();
    });

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith('/login', { replace: true });
    });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /back to login/i }),
    ).not.toBeInTheDocument();
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

  it('does NOT queue a notice or navigate when the MFA branch is taken (handled by handleVerifyOtp)', async () => {
    vi.mocked(apiModule.verifyMagicLink).mockResolvedValue({
      mfaToken: 'mfa-tok-123',
      mfaMethod: 'totp',
    });

    await act(async () => {
      renderPage();
    });

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    expect(pendingNoticeModule.setPendingNotice).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });
});
