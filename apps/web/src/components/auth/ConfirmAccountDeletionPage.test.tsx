/**
 * Tests for ConfirmAccountDeletionPage.
 *
 * State machine: verifying → auto-redirect to /login (success OR failure).
 * Token-from-URL paths:
 *   - No token → setPendingNotice('deletion-link-invalid') + navigate('/login')
 *   - Valid token → confirmAccountDeletion() → setPendingNotice('account-deleted')
 *     + logout() + navigate('/login')
 *   - API error → setPendingNotice('deletion-link-invalid') + navigate('/login')
 *
 * The page no longer renders an error card. All failure paths
 * redirect to /login, where the AuthForm surfaces the queued error-variant
 * notice as an assertive toast.
 */

import ConfirmAccountDeletionPage from './ConfirmAccountDeletionPage';
import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../../lib/api', () => ({
  confirmAccountDeletion: vi.fn(),
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
  overrides: Partial<{ logout: ReturnType<typeof vi.fn> }> = {},
) {
  return {
    loading: false,
    login: vi.fn(),
    loginWithToken: vi.fn(),
    logout: vi.fn(),
    register: vi.fn(),
    refreshUser: vi.fn(),
    resendEmailChangeVerification: vi.fn(),
    resendVerificationEmail: vi.fn(),
    setPendingEmail: vi.fn(),
    markWelcomed: vi.fn(),
    user: null,
    ...overrides,
  };
}

function renderPage(search = '?token=valid-token') {
  return render(
    <MemoryRouter initialEntries={[`/account/confirm-deletion${search}`]}>
      <ConfirmAccountDeletionPage />
    </MemoryRouter>,
  );
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useAuth).mockReturnValue(makeAuthContext());
  vi.mocked(apiModule.confirmAccountDeletion).mockResolvedValue(undefined);
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ConfirmAccountDeletionPage verifying state', () => {
  it('renders a polite sr-only status message while verifying', () => {
    vi.mocked(apiModule.confirmAccountDeletion).mockReturnValue(
      new Promise(() => {}),
    );

    renderPage();

    const status = screen.getByRole('status');
    expect(status).toBeInTheDocument();
    expect(status).toHaveTextContent(/verifying your deletion link/i);
    // The status node carries `sr-only` – verifying state is visually a bare
    // spinner. No card heading is rendered (errors redirect to /login).
    expect(status).toHaveClass('sr-only');
  });

  it('does not render the legacy "Verifying deletion link" card heading', () => {
    vi.mocked(apiModule.confirmAccountDeletion).mockReturnValue(
      new Promise(() => {}),
    );

    renderPage();

    expect(
      screen.queryByRole('heading', { name: /verifying deletion link/i }),
    ).not.toBeInTheDocument();
  });
});

describe('ConfirmAccountDeletionPage success path (auto-redirect)', () => {
  it('calls confirmAccountDeletion with the token from the URL', async () => {
    vi.mocked(apiModule.confirmAccountDeletion).mockResolvedValue(undefined);

    await act(async () => {
      renderPage('?token=del-token-xyz');
    });

    await waitFor(() => {
      expect(apiModule.confirmAccountDeletion).toHaveBeenCalledWith(
        'del-token-xyz',
      );
    });
  });

  it('queues the account-deleted notice automatically on success', async () => {
    await act(async () => {
      renderPage();
    });

    await waitFor(() => {
      expect(pendingNoticeModule.setPendingNotice).toHaveBeenCalledWith(
        'account-deleted',
      );
    });
  });

  it('calls logout automatically on success', async () => {
    const logout = vi.fn();
    vi.mocked(useAuth).mockReturnValue(makeAuthContext({ logout }));

    await act(async () => {
      renderPage();
    });

    await waitFor(() => {
      expect(logout).toHaveBeenCalled();
    });
  });

  it('navigates to /login with replace:true automatically on success', async () => {
    await act(async () => {
      renderPage();
    });

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith('/login', { replace: true });
    });
  });

  it('does not render an "Account deleted" success card after the API resolves', async () => {
    await act(async () => {
      renderPage();
    });

    // Wait for navigate to fire, then confirm no success heading was rendered
    // along the way (state collapses verifying → auto-redirect).
    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith('/login', { replace: true });
    });

    expect(
      screen.queryByRole('heading', { name: /account deleted/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /continue to sign-in/i }),
    ).not.toBeInTheDocument();
  });
});

describe('ConfirmAccountDeletionPage error paths – redirect to /login with toast', () => {
  it('queues deletion-link-invalid + navigates to /login when no token is present', async () => {
    await act(async () => {
      renderPage('');
    });

    await waitFor(() => {
      expect(pendingNoticeModule.setPendingNotice).toHaveBeenCalledWith(
        'deletion-link-invalid',
      );
    });
    expect(navigate).toHaveBeenCalledWith('/login', { replace: true });
    expect(apiModule.confirmAccountDeletion).not.toHaveBeenCalled();
  });

  it('queues deletion-link-invalid + navigates to /login when confirmAccountDeletion rejects', async () => {
    vi.mocked(apiModule.confirmAccountDeletion).mockRejectedValue(
      new Error('Token expired'),
    );

    await act(async () => {
      renderPage();
    });

    await waitFor(() => {
      expect(pendingNoticeModule.setPendingNotice).toHaveBeenCalledWith(
        'deletion-link-invalid',
      );
    });
    expect(navigate).toHaveBeenCalledWith('/login', { replace: true });
  });

  it('queues deletion-link-invalid + navigates to /login even when a non-Error is thrown', async () => {
    vi.mocked(apiModule.confirmAccountDeletion).mockRejectedValue('boom');

    await act(async () => {
      renderPage();
    });

    await waitFor(() => {
      expect(pendingNoticeModule.setPendingNotice).toHaveBeenCalledWith(
        'deletion-link-invalid',
      );
    });
    expect(navigate).toHaveBeenCalledWith('/login', { replace: true });
  });

  it('does not call logout when the API rejects (no session was confirmed deleted)', async () => {
    const logout = vi.fn();
    vi.mocked(useAuth).mockReturnValue(makeAuthContext({ logout }));
    vi.mocked(apiModule.confirmAccountDeletion).mockRejectedValue(
      new Error('expired'),
    );

    await act(async () => {
      renderPage();
    });

    await waitFor(() => {
      expect(pendingNoticeModule.setPendingNotice).toHaveBeenCalledWith(
        'deletion-link-invalid',
      );
    });
    expect(logout).not.toHaveBeenCalled();
  });

  it('does not render the legacy error card (no alert role, no back-to-home button)', async () => {
    vi.mocked(apiModule.confirmAccountDeletion).mockRejectedValue(
      new Error('expired'),
    );

    await act(async () => {
      renderPage();
    });

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith('/login', { replace: true });
    });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: /this link can't be used/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /back to home/i }),
    ).not.toBeInTheDocument();
  });
});
