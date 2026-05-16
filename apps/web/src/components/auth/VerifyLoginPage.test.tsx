import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import VerifyLoginPage from './VerifyLoginPage';

vi.mock('../../lib/api', () => ({
  verifyMagicLink: vi.fn(),
}));

vi.mock('../../auth/AuthContext', () => ({
  useAuth: vi.fn(),
}));

import * as apiModule from '../../lib/api';
import { useAuth } from '../../auth/AuthContext';

function makeAuthContext(overrides = {}) {
  return {
    loading: false,
    login: vi.fn(),
    loginWithToken: vi.fn().mockResolvedValue(undefined),
    logout: vi.fn(),
    refreshUser: vi.fn(),
    register: vi.fn(),
    resendVerificationEmail: vi.fn(),
    setPendingEmail: vi.fn(),
    user: null,
    ...overrides,
  };
}

function renderPage(token?: string) {
  const search = token ? `?token=${token}` : '';
  return render(
    <MemoryRouter initialEntries={[`/verify-login${search}`]}>
      <Routes>
        <Route path="/verify-login" element={<VerifyLoginPage />} />
        <Route path="/unread" element={<div>Unread page</div>} />
        <Route path="/login" element={<div>Login page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useAuth).mockReturnValue(makeAuthContext());
});

describe('VerifyLoginPage', () => {
  it('shows verifying state initially', () => {
    vi.mocked(apiModule.verifyMagicLink).mockReturnValue(new Promise(() => {}));

    renderPage('valid-token');

    expect(screen.getByText(/verifying your login link/i)).toBeInTheDocument();
  });

  it('calls loginWithToken and redirects to /unread on success', async () => {
    const loginWithToken = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useAuth).mockReturnValue(makeAuthContext({ loginWithToken }));
    vi.mocked(apiModule.verifyMagicLink).mockResolvedValue({
      accessToken: 'jwt-tok',
    });

    renderPage('valid-token');

    await waitFor(() => {
      expect(apiModule.verifyMagicLink).toHaveBeenCalledWith('valid-token');
      expect(loginWithToken).toHaveBeenCalledWith('jwt-tok');
      expect(screen.getByText(/unread page/i)).toBeInTheDocument();
    });
  });

  it('shows an error when the token is missing', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/no login token found/i)).toBeInTheDocument();
    });
  });

  it('shows an error when verifyMagicLink fails', async () => {
    vi.mocked(apiModule.verifyMagicLink).mockRejectedValue(
      new Error('Token expired'),
    );

    renderPage('bad-token');

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/token expired/i)).toBeInTheDocument();
    });
  });

  it('shows a Back to login link on error', async () => {
    vi.mocked(apiModule.verifyMagicLink).mockRejectedValue(
      new Error('Token expired'),
    );

    renderPage('bad-token');

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /back to login/i }),
      ).toBeInTheDocument();
    });
  });
});
