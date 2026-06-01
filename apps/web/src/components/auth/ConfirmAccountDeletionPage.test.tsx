import {
  act,
  render,
  screen,
  waitFor,
  fireEvent,
} from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import ConfirmAccountDeletionPage from './ConfirmAccountDeletionPage';
import { consumeAuthNotice } from '../../auth/authNotice';

vi.mock('../../lib/api', () => ({
  confirmAccountDeletion: vi.fn(),
}));

vi.mock('../../auth/AuthContext', () => ({
  useAuth: vi.fn(),
}));

const navigateMock = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

import * as apiModule from '../../lib/api';
import { useAuth } from '../../auth/AuthContext';

function renderWithRouter(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="/account/confirm-deletion"
          element={<ConfirmAccountDeletionPage />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

const logoutMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useAuth).mockReturnValue({
    loading: false,
    login: vi.fn(),
    loginWithToken: vi.fn(),
    logout: logoutMock,
    refreshUser: vi.fn(),
    register: vi.fn(),
    resendVerificationEmail: vi.fn(),
    setPendingEmail: vi.fn(),
    user: null,
  } as unknown as ReturnType<typeof useAuth>);
});

afterEach(() => {
  vi.restoreAllMocks();
  navigateMock.mockClear();
  logoutMock.mockClear();
  window.sessionStorage.clear();
});

describe('ConfirmAccountDeletionPage — verifying state', () => {
  it('calls confirmAccountDeletion with the token from the query string', async () => {
    vi.mocked(apiModule.confirmAccountDeletion).mockResolvedValue(undefined);
    renderWithRouter('/account/confirm-deletion?token=abc123');
    await waitFor(() => {
      expect(apiModule.confirmAccountDeletion).toHaveBeenCalledWith('abc123');
    });
  });

  it('shows a verifying status announcement while in flight', () => {
    vi.mocked(apiModule.confirmAccountDeletion).mockReturnValue(
      new Promise(() => {}),
    );
    renderWithRouter('/account/confirm-deletion?token=abc');
    expect(screen.getByRole('status')).toHaveTextContent(
      /verifying your deletion link/i,
    );
    expect(
      screen.getByRole('heading', { name: /verifying deletion link/i }),
    ).toBeInTheDocument();
  });

  it('does not double-fire the API call when the effect runs twice in one mount', async () => {
    vi.mocked(apiModule.confirmAccountDeletion).mockResolvedValue(undefined);
    const { rerender } = render(
      <MemoryRouter initialEntries={['/account/confirm-deletion?token=once']}>
        <Routes>
          <Route
            path="/account/confirm-deletion"
            element={<ConfirmAccountDeletionPage />}
          />
        </Routes>
      </MemoryRouter>,
    );
    // A re-render with the same component instance should NOT re-fire the
    // confirm call — `hasConfirmed` is a per-mount ref guard.
    rerender(
      <MemoryRouter initialEntries={['/account/confirm-deletion?token=once']}>
        <Routes>
          <Route
            path="/account/confirm-deletion"
            element={<ConfirmAccountDeletionPage />}
          />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(apiModule.confirmAccountDeletion).toHaveBeenCalledTimes(1);
    });
  });
});

describe('ConfirmAccountDeletionPage — success state', () => {
  it('renders the success heading + alert when the API succeeds', async () => {
    vi.mocked(apiModule.confirmAccountDeletion).mockResolvedValue(undefined);
    renderWithRouter('/account/confirm-deletion?token=abc');
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Account deleted' }),
      ).toBeInTheDocument();
    });
    expect(screen.getByRole('status')).toHaveTextContent(
      /your account has been permanently deleted/i,
    );
  });

  it('focuses the Continue button on success-state mount', async () => {
    vi.mocked(apiModule.confirmAccountDeletion).mockResolvedValue(undefined);
    await act(async () => {
      renderWithRouter('/account/confirm-deletion?token=abc');
    });
    await waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: /continue to sign-in/i }),
      );
    });
  });

  it('Continue triggers logout + navigate(/auth) + queues the account-deleted notice', async () => {
    vi.mocked(apiModule.confirmAccountDeletion).mockResolvedValue(undefined);
    renderWithRouter('/account/confirm-deletion?token=abc');
    const continueButton = await screen.findByRole('button', {
      name: /continue to sign-in/i,
    });
    fireEvent.click(continueButton);
    expect(logoutMock).toHaveBeenCalledOnce();
    expect(navigateMock).toHaveBeenCalledWith('/auth', { replace: true });
    expect(consumeAuthNotice()).toBe('Your account has been deleted.');
  });
});

describe('ConfirmAccountDeletionPage — error state', () => {
  it('renders error state when token is missing', async () => {
    renderWithRouter('/account/confirm-deletion');
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /this link can't be used/i }),
      ).toBeInTheDocument();
    });
    expect(screen.getByRole('alert')).toHaveTextContent(
      /no confirmation token found/i,
    );
    expect(apiModule.confirmAccountDeletion).not.toHaveBeenCalled();
  });

  it('renders error state when the API rejects', async () => {
    vi.mocked(apiModule.confirmAccountDeletion).mockRejectedValue(
      new Error('Invalid or expired confirmation token'),
    );
    renderWithRouter('/account/confirm-deletion?token=bad');
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /this link can't be used/i }),
      ).toBeInTheDocument();
    });
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Invalid or expired confirmation token',
    );
  });

  it('does not call logout or navigate from the error state', async () => {
    vi.mocked(apiModule.confirmAccountDeletion).mockRejectedValue(
      new Error('bad'),
    );
    renderWithRouter('/account/confirm-deletion?token=bad');
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(logoutMock).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('focuses the back button on error-state mount', async () => {
    vi.mocked(apiModule.confirmAccountDeletion).mockRejectedValue(
      new Error('bad'),
    );
    await act(async () => {
      renderWithRouter('/account/confirm-deletion?token=bad');
    });
    await waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: /back to home/i }),
      );
    });
  });
});

describe('ConfirmAccountDeletionPage — page semantics', () => {
  it('renders a <main> landmark', () => {
    vi.mocked(apiModule.confirmAccountDeletion).mockReturnValue(
      new Promise(() => {}),
    );
    renderWithRouter('/account/confirm-deletion?token=abc');
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it('sets the document title for each state', async () => {
    vi.mocked(apiModule.confirmAccountDeletion).mockResolvedValue(undefined);
    renderWithRouter('/account/confirm-deletion?token=abc');
    await waitFor(() => {
      expect(document.title).toBe('Account deleted — Linklater');
    });
  });
});
