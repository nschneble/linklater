import App from './App';
import { AuthProvider } from './auth/AuthContext';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from './theme/ThemeContext';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from './auth/AuthContext';

vi.mock('./lib/api', () => ({
  getMe: vi.fn(),
  getStoredToken: vi.fn(),
  clearStoredToken: vi.fn(),
  setStoredToken: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  register: vi.fn(),
  resendVerificationEmail: vi.fn(),
}));

import * as apiModule from './lib/api';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    cvdMode: false,
    connectedProviders: [],
    email: 'test@example.com',
    emailVerifiedAt: null,
    hasPassword: true,
    mode: 'dark',
    pendingEmail: null,
    theme: 'scanner-darkly',
    twoFactorMethod: null,
    twoFactorPending: false,
    userId: 'user-1',
    ...overrides,
  };
}

function renderApp() {
  return render(
    <MemoryRouter>
      <ThemeProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ThemeProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: no stored token → immediate loading=false, user=null
  vi.mocked(apiModule.getStoredToken).mockReturnValue(null);
  vi.mocked(apiModule.getMe).mockRejectedValue(new Error('no token'));
  // Clear any CVD-related localStorage state
  window.localStorage.removeItem('linklater_cvd_mode');
  window.localStorage.removeItem('linklater_cvd_updated_at');
  window.localStorage.removeItem('linklater_pre_cvd_theme');
  delete document.documentElement.dataset.cvd;
});

afterEach(() => {
  vi.restoreAllMocks();
  delete document.documentElement.dataset.cvd;
});

describe('App auth UI', () => {
  it('shows the landing page when not logged in', () => {
    renderApp();
    expect(
      screen.getByText(/Save links now, read them later/i),
    ).toBeInTheDocument();
  });
});

describe('App loading state', () => {
  beforeEach(() => {
    // Return a stored token so AuthProvider attempts getMe, keeping
    // loading=true for the duration of the never-resolving promise.
    vi.mocked(apiModule.getStoredToken).mockReturnValue('fake-jwt');
    vi.mocked(apiModule.getMe).mockImplementation(() => new Promise(() => {}));
  });

  it('renders a role="status" container while the auth check is in flight', () => {
    renderApp();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders the loading message inside the status container', () => {
    renderApp();
    expect(screen.getByText(/defrosting linklater/i)).toBeInTheDocument();
  });
});

describe('App CVD sync', () => {
  beforeEach(() => {
    vi.mocked(apiModule.getStoredToken).mockReturnValue('fake-jwt');
  });

  it('sets data-cvd="on" when server user has cvdMode=true', async () => {
    vi.mocked(apiModule.getMe).mockResolvedValue(
      makeUser({ cvdMode: true }) as never,
    );
    renderApp();
    await waitFor(() => {
      expect(document.documentElement.dataset.cvd).toBe('on');
    });
  });

  it('does not set data-cvd when server user has cvdMode=false', async () => {
    vi.mocked(apiModule.getMe).mockResolvedValue(
      makeUser({ cvdMode: false }) as never,
    );
    renderApp();
    await waitFor(() => {
      // Loading should resolve
      expect(screen.queryByRole('status')).toBeNull();
    });
    expect(document.documentElement.dataset.cvd).toBeUndefined();
  });

  it('skips server sync when a local CVD change was made within 30s', async () => {
    // Mark a recent local write
    window.localStorage.setItem(
      'linklater_cvd_updated_at',
      Date.now().toString(),
    );
    vi.mocked(apiModule.getMe).mockResolvedValue(
      makeUser({ cvdMode: true }) as never,
    );
    renderApp();
    await waitFor(() => {
      expect(screen.queryByRole('status')).toBeNull();
    });
    // Should NOT have enabled CVD mode (recent local change takes priority)
    expect(document.documentElement.dataset.cvd).toBeUndefined();
  });
});
