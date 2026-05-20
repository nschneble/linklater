import App from './App';
import { AuthProvider } from './auth/AuthContext';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from './theme/ThemeContext';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
});

afterEach(() => vi.restoreAllMocks());

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
