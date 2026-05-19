import LogoutPage from './LogoutPage';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { render, waitFor } from '@testing-library/react';

vi.mock('../../auth/AuthContext', () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from '../../auth/AuthContext';

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
    refreshUser: vi.fn(),
    user: null,
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/logout']}>
      <LogoutPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.mocked(useAuth).mockReturnValue(makeAuthContext());
  vi.clearAllMocks();
});

describe('LogoutPage', () => {
  it('calls logout on mount', async () => {
    const logout = vi.fn();
    vi.mocked(useAuth).mockReturnValue(makeAuthContext({ logout }));

    renderPage();

    await waitFor(() => {
      expect(logout).toHaveBeenCalledOnce();
    });
  });

  it('navigates to /login after logout', async () => {
    renderPage();

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
    });
  });

  it('renders nothing', () => {
    const { container } = renderPage();
    expect(container).toBeEmptyDOMElement();
  });
});
