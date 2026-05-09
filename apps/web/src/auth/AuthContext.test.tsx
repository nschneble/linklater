/**
 * Tests for AuthContext / AuthProvider / useAuth.
 *
 * All API calls are mocked at the module boundary so no network traffic occurs.
 * localStorage is provided by the jsdom setup in test/setup.ts.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';

// ---------------------------------------------------------------------------
// Mock the api module
// ---------------------------------------------------------------------------

vi.mock('../lib/api', () => ({
  clearStoredToken: vi.fn(),
  getMe: vi.fn(),
  getStoredToken: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  register: vi.fn(),
  resendVerificationEmail: vi.fn(),
  setStoredToken: vi.fn(),
}));

import * as apiModule from '../lib/api';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeUser = () => ({
  userId: 'user-1',
  email: 'user@example.com',
  emailVerifiedAt: '2024-01-01T00:00:00Z',
  hasPassword: true,
  pendingEmail: null,
  mode: 'dark',
  theme: 'scanner-darkly',
});

/** Tiny consumer that surfaces auth state into the DOM for assertions. */
function AuthConsumer() {
  const {
    user,
    loading,
    login,
    logout,
    register,
    resendVerificationEmail,
    setPendingEmail,
  } = useAuth();

  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="email">{user?.email ?? 'none'}</span>
      <span data-testid="pending">{user?.pendingEmail ?? 'none'}</span>
      <button type="button" onClick={() => login('user@example.com', 'pass')}>
        login
      </button>
      <button type="button" onClick={() => logout()}>
        logout
      </button>
      <button
        type="button"
        onClick={() => register('user@example.com', 'pass')}
      >
        register
      </button>
      <button type="button" onClick={() => resendVerificationEmail()}>
        resend
      </button>
      <button type="button" onClick={() => setPendingEmail('new@example.com')}>
        setPending
      </button>
    </div>
  );
}

function renderWithProvider() {
  return render(
    <AuthProvider>
      <AuthConsumer />
    </AuthProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Initial load — no stored token
// ---------------------------------------------------------------------------

describe('AuthProvider initial state', () => {
  it('sets loading to false when there is no stored token', async () => {
    vi.mocked(apiModule.getStoredToken).mockReturnValue(null);

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });
    expect(screen.getByTestId('email')).toHaveTextContent('none');
  });

  it('hydrates user from stored token on mount', async () => {
    vi.mocked(apiModule.getStoredToken).mockReturnValue('stored-jwt');
    vi.mocked(apiModule.getMe).mockResolvedValue(makeUser());

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByTestId('email')).toHaveTextContent('user@example.com');
    });
    expect(screen.getByTestId('loading')).toHaveTextContent('false');
  });

  it('clears the token when the stored token is rejected by the server', async () => {
    vi.mocked(apiModule.getStoredToken).mockReturnValue('expired-jwt');
    vi.mocked(apiModule.getMe).mockRejectedValue(new Error('Unauthorized'));

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    expect(apiModule.clearStoredToken).toHaveBeenCalled();
    expect(screen.getByTestId('email')).toHaveTextContent('none');
  });
});

// ---------------------------------------------------------------------------
// login
// ---------------------------------------------------------------------------

describe('login', () => {
  it('populates user state after successful login', async () => {
    vi.mocked(apiModule.getStoredToken).mockReturnValue(null);
    vi.mocked(apiModule.login).mockResolvedValue({ accessToken: 'new-jwt' });
    vi.mocked(apiModule.getMe).mockResolvedValue(makeUser());

    renderWithProvider();

    await waitFor(() =>
      expect(screen.getByTestId('loading')).toHaveTextContent('false'),
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'login' }));
    });

    expect(screen.getByTestId('email')).toHaveTextContent('user@example.com');
  });

  it('propagates errors thrown by the API', async () => {
    vi.mocked(apiModule.getStoredToken).mockReturnValue(null);
    vi.mocked(apiModule.login).mockRejectedValue(
      new Error('Invalid credentials'),
    );

    // A consumer that captures the rejection rather than leaving it unhandled.
    let caughtError: Error | null = null;

    function CapturingConsumer() {
      const { loading, login: doLogin } = useAuth();
      return (
        <div>
          <span data-testid="loading">{String(loading)}</span>
          <button
            type="button"
            onClick={() => {
              doLogin('user@example.com', 'pass').catch((error: Error) => {
                caughtError = error;
              });
            }}
          >
            login-capture
          </button>
        </div>
      );
    }

    render(
      <AuthProvider>
        <CapturingConsumer />
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId('loading')).toHaveTextContent('false'),
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'login-capture' }));
    });

    await waitFor(() => expect(caughtError).not.toBeNull());
    expect(caughtError!.message).toBe('Invalid credentials');
  });
});

// ---------------------------------------------------------------------------
// logout
// ---------------------------------------------------------------------------

describe('logout', () => {
  it('clears user state and calls apiLogout', async () => {
    vi.mocked(apiModule.getStoredToken).mockReturnValue('stored-jwt');
    vi.mocked(apiModule.getMe).mockResolvedValue(makeUser());

    renderWithProvider();

    await waitFor(() =>
      expect(screen.getByTestId('email')).toHaveTextContent('user@example.com'),
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'logout' }));
    });

    expect(apiModule.logout).toHaveBeenCalled();
    expect(screen.getByTestId('email')).toHaveTextContent('none');
  });
});

// ---------------------------------------------------------------------------
// register
// ---------------------------------------------------------------------------

describe('register', () => {
  it('calls apiRegister then logs in automatically', async () => {
    vi.mocked(apiModule.getStoredToken).mockReturnValue(null);
    vi.mocked(apiModule.register).mockResolvedValue(undefined);
    vi.mocked(apiModule.login).mockResolvedValue({ accessToken: 'jwt' });
    vi.mocked(apiModule.getMe).mockResolvedValue(makeUser());

    renderWithProvider();

    await waitFor(() =>
      expect(screen.getByTestId('loading')).toHaveTextContent('false'),
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'register' }));
    });

    expect(apiModule.register).toHaveBeenCalledWith('user@example.com', 'pass');
    expect(screen.getByTestId('email')).toHaveTextContent('user@example.com');
  });
});

// ---------------------------------------------------------------------------
// resendVerificationEmail
// ---------------------------------------------------------------------------

describe('resendVerificationEmail', () => {
  it('calls the API resend function', async () => {
    vi.mocked(apiModule.getStoredToken).mockReturnValue(null);
    vi.mocked(apiModule.resendVerificationEmail).mockResolvedValue(undefined);

    renderWithProvider();

    await waitFor(() =>
      expect(screen.getByTestId('loading')).toHaveTextContent('false'),
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'resend' }));
    });

    expect(apiModule.resendVerificationEmail).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// setPendingEmail
// ---------------------------------------------------------------------------

describe('setPendingEmail', () => {
  it('updates pendingEmail in user state without a refetch', async () => {
    vi.mocked(apiModule.getStoredToken).mockReturnValue('stored-jwt');
    vi.mocked(apiModule.getMe).mockResolvedValue(makeUser());

    renderWithProvider();

    await waitFor(() =>
      expect(screen.getByTestId('email')).toHaveTextContent('user@example.com'),
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'setPending' }));
    });

    expect(screen.getByTestId('pending')).toHaveTextContent('new@example.com');
  });

  it('is a no-op when user is null', async () => {
    vi.mocked(apiModule.getStoredToken).mockReturnValue(null);

    renderWithProvider();

    await waitFor(() =>
      expect(screen.getByTestId('loading')).toHaveTextContent('false'),
    );

    // Should not throw
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'setPending' }));
    });

    expect(screen.getByTestId('pending')).toHaveTextContent('none');
  });
});

// ---------------------------------------------------------------------------
// loginWithToken
// ---------------------------------------------------------------------------

describe('loginWithToken', () => {
  it('stores the token, fetches user profile, and populates user state', async () => {
    vi.mocked(apiModule.getStoredToken).mockReturnValue(null);
    vi.mocked(apiModule.setStoredToken).mockImplementation(() => undefined);
    vi.mocked(apiModule.getMe).mockResolvedValue(makeUser());

    function TokenLoginConsumer() {
      const { user, loginWithToken } = useAuth();
      return (
        <div>
          <span data-testid="email">{user?.email ?? 'none'}</span>
          <button
            type="button"
            onClick={() => loginWithToken('oauth-jwt-token')}
          >
            loginWithToken
          </button>
        </div>
      );
    }

    render(
      <AuthProvider>
        <TokenLoginConsumer />
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId('email')).toHaveTextContent('none'),
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'loginWithToken' }));
    });

    expect(apiModule.setStoredToken).toHaveBeenCalledWith('oauth-jwt-token');
    expect(screen.getByTestId('email')).toHaveTextContent('user@example.com');
  });
});

// ---------------------------------------------------------------------------
// useAuth outside provider
// ---------------------------------------------------------------------------

describe('useAuth outside AuthProvider', () => {
  it('throws a descriptive error', () => {
    function Naked() {
      useAuth();
      return null;
    }

    expect(() => render(<Naked />)).toThrow(
      'useAuth must be used within an AuthProvider',
    );
  });
});
