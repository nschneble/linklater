import { render, screen, waitFor } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import OAuthCallbackPage from './OAuthCallbackPage';

vi.mock('../auth/AuthContext', () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from '../auth/AuthContext';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

function makeAuthContext(overrides = {}) {
  return {
    loading: false,
    login: vi.fn(),
    loginWithToken: vi.fn(),
    logout: vi.fn(),
    register: vi.fn(),
    resendVerificationEmail: vi.fn(),
    setPendingEmail: vi.fn(),
    user: null,
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/oauth/callback']}>
      <OAuthCallbackPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.mocked(useAuth).mockReturnValue(makeAuthContext());
  mockNavigate.mockClear();
  window.location.hash = '#token=oauth-jwt-123';
});

afterEach(() => {
  vi.restoreAllMocks();
  window.location.hash = '';
});

describe('OAuthCallbackPage', () => {
  it('shows the signing in heading', () => {
    vi.mocked(useAuth).mockReturnValue(
      makeAuthContext({ loginWithToken: () => new Promise(() => {}) }),
    );
    renderPage();
    expect(screen.getByText(/signing you in/i)).toBeInTheDocument();
  });

  it('shows a loading pulse while loginWithToken is in flight', () => {
    vi.mocked(useAuth).mockReturnValue(
      makeAuthContext({ loginWithToken: () => new Promise(() => {}) }),
    );
    renderPage();
    expect(screen.getByText(/just a moment/i)).toBeInTheDocument();
  });

  it('calls loginWithToken with the token from the URL hash', async () => {
    const loginWithToken = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useAuth).mockReturnValue(makeAuthContext({ loginWithToken }));

    window.location.hash = '#token=my-oauth-token';
    renderPage();

    await waitFor(() => {
      expect(loginWithToken).toHaveBeenCalledWith('my-oauth-token');
    });
  });

  it('navigates to /unread after successful login', async () => {
    const loginWithToken = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useAuth).mockReturnValue(makeAuthContext({ loginWithToken }));

    renderPage();

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/unread', { replace: true });
    });
  });

  it('shows an error when no token is present in the hash', async () => {
    window.location.hash = '';
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(
        screen.getByText(/invalid authentication response/i),
      ).toBeInTheDocument();
    });
  });

  it('shows an error when loginWithToken rejects', async () => {
    const loginWithToken = vi.fn().mockRejectedValue(new Error('Server error'));
    vi.mocked(useAuth).mockReturnValue(makeAuthContext({ loginWithToken }));

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Server error')).toBeInTheDocument();
    });
  });

  it('shows a Back to login button on error', async () => {
    window.location.hash = '';
    renderPage();

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /back to login/i }),
      ).toBeInTheDocument();
    });
  });

  it('navigates to / when Back to login is clicked', async () => {
    window.location.hash = '';
    renderPage();

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /back to login/i }),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /back to login/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });
});
