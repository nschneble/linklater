/**
 * Tests for ConfirmAccountDeletionPage.
 *
 * State machine: verifying → success | error
 * Token-from-URL paths:
 *   - No token → error state without API call
 *   - Valid token → confirmAccountDeletion() → success
 *   - API error → error state
 */

import ConfirmAccountDeletionPage from './ConfirmAccountDeletionPage';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../../lib/api', () => ({
  confirmAccountDeletion: vi.fn(),
}));

vi.mock('../../auth/authNotice', () => ({
  setAuthNotice: vi.fn(),
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
  overrides: Partial<{ logout: ReturnType<typeof vi.fn> }> = {},
) {
  return {
    loading: false,
    login: vi.fn(),
    loginWithToken: vi.fn(),
    logout: vi.fn(),
    register: vi.fn(),
    refreshUser: vi.fn(),
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
  it('shows a status message while verifying', () => {
    vi.mocked(apiModule.confirmAccountDeletion).mockReturnValue(
      new Promise(() => {}),
    );

    renderPage();

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(
      screen.getByText(/verifying your deletion link/i),
    ).toBeInTheDocument();
  });
});

describe('ConfirmAccountDeletionPage success path', () => {
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

  it('shows "Account deleted" heading after successful confirmation', async () => {
    await act(async () => {
      renderPage();
    });

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /account deleted/i }),
      ).toBeInTheDocument();
    });
  });

  it('shows a success alert message', async () => {
    await act(async () => {
      renderPage();
    });

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(
        /permanently deleted/i,
      );
    });
  });

  it('"Continue to sign-in" button calls logout', async () => {
    const logout = vi.fn();
    vi.mocked(useAuth).mockReturnValue(makeAuthContext({ logout }));

    await act(async () => {
      renderPage();
    });

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /continue to sign-in/i }),
      ).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole('button', { name: /continue to sign-in/i }),
    );

    expect(logout).toHaveBeenCalled();
  });

  it('"Continue to sign-in" button navigates to /auth', async () => {
    await act(async () => {
      renderPage();
    });

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /continue to sign-in/i }),
      ).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole('button', { name: /continue to sign-in/i }),
    );

    expect(navigate).toHaveBeenCalledWith('/auth', { replace: true });
  });
});

describe('ConfirmAccountDeletionPage error paths', () => {
  it('shows an error when no token is in the URL', async () => {
    await act(async () => {
      renderPage('');
    });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    expect(apiModule.confirmAccountDeletion).not.toHaveBeenCalled();
  });

  it('shows error heading when the token is missing', async () => {
    await act(async () => {
      renderPage('');
    });

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /this link can't be used/i }),
      ).toBeInTheDocument();
    });
  });

  it('shows an error when confirmAccountDeletion rejects', async () => {
    vi.mocked(apiModule.confirmAccountDeletion).mockRejectedValue(
      new Error('Token expired'),
    );

    await act(async () => {
      renderPage();
    });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/token expired/i);
    });
  });

  it('shows the fallback error when a non-Error is thrown', async () => {
    vi.mocked(apiModule.confirmAccountDeletion).mockRejectedValue('boom');

    await act(async () => {
      renderPage();
    });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        /invalid, expired, or has already been used/i,
      );
    });
  });

  it('"Back to home" button navigates to home', async () => {
    vi.mocked(apiModule.confirmAccountDeletion).mockRejectedValue(
      new Error('expired'),
    );

    await act(async () => {
      renderPage();
    });

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /back to home/i }),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /back to home/i }));

    expect(navigate).toHaveBeenCalledWith('/', { replace: true });
  });
});
