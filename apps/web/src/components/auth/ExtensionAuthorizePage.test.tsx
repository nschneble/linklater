import { MemoryRouter } from 'react-router-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ExtensionAuthorizePage from './ExtensionAuthorizePage';
import * as authContext from '../../auth/AuthContext';
import type { User } from '../../auth/AuthContext';

vi.mock('../../auth/AuthContext', async () => {
  const actual = await vi.importActual<typeof import('../../auth/AuthContext')>(
    '../../auth/AuthContext',
  );
  return {
    ...actual,
    useAuth: vi.fn(),
  };
});

function renderPage(
  query: string = '?code_challenge=abc&redirect_uri=chrome-extension%3A%2F%2Fext%2Fcb',
) {
  return render(
    <MemoryRouter initialEntries={[`/extension/authorize${query}`]}>
      <ExtensionAuthorizePage />
    </MemoryRouter>,
  );
}

function makeUser(overrides: Partial<User> = {}): User {
  return {
    userId: 'user-1',
    email: 'user@example.com',
    emailVerifiedAt: '2026-01-01T00:00:00.000Z',
    theme: 'scanner-darkly',
    mode: 'dark',
    cvdMode: false,
    hasPassword: true,
    twoFactorMethod: null,
    twoFactorPending: false,
    pendingEmail: null,
    connectedProviders: [],
    ...overrides,
  } as User;
}

function mockUseAuth(user: User | null) {
  (authContext.useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
    user,
  } as unknown);
}

describe('ExtensionAuthorizePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('unauthenticated', () => {
    it('renders a sign-in prompt with a link to /login', () => {
      mockUseAuth(null);
      renderPage();
      expect(
        screen.getByRole('heading', { name: /sign in to authorize/i }),
      ).toBeInTheDocument();
      const signInLink = screen.getByRole('link', { name: /sign in/i });
      expect(signInLink).toHaveAttribute('href', '/login');
    });

    it('does not show the authorize controls', () => {
      mockUseAuth(null);
      renderPage();
      expect(
        screen.queryByRole('button', { name: /authorize/i }),
      ).not.toBeInTheDocument();
    });
  });

  describe('authenticated', () => {
    it('renders the authorize confirmation with the user email', () => {
      mockUseAuth(makeUser({ email: 'alice@example.com' }));
      renderPage();
      expect(
        screen.getByRole('heading', { name: /authorize linklater extension/i }),
      ).toBeInTheDocument();
      expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    });

    it('redirects to the API authorize endpoint with PKCE params on Authorize', () => {
      mockUseAuth(makeUser());
      const mockLocation = {
        href: 'http://localhost:5173/extension/authorize',
      };
      vi.stubGlobal('location', mockLocation);

      renderPage(
        '?code_challenge=challenge-abc&redirect_uri=chrome-extension%3A%2F%2Fext%2Fcb',
      );
      fireEvent.click(screen.getByRole('button', { name: /^authorize$/i }));

      expect(mockLocation.href).toContain('/auth/extension/authorize');
      expect(mockLocation.href).toContain('code_challenge=challenge-abc');
      expect(mockLocation.href).toContain(
        'redirect_uri=chrome-extension%3A%2F%2Fext%2Fcb',
      );

      vi.unstubAllGlobals();
    });

    it('disables both buttons and updates label while authorizing', () => {
      mockUseAuth(makeUser());
      const mockLocation = {
        href: 'http://localhost:5173/extension/authorize',
      };
      vi.stubGlobal('location', mockLocation);

      renderPage();
      fireEvent.click(screen.getByRole('button', { name: /^authorize$/i }));

      expect(
        screen.getByRole('button', { name: /authorizing/i }),
      ).toBeDisabled();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();

      vi.unstubAllGlobals();
    });

    it('calls window.close when Cancel is clicked', () => {
      mockUseAuth(makeUser());
      const close = vi.fn();
      vi.stubGlobal('close', close);

      renderPage();
      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

      expect(close).toHaveBeenCalledTimes(1);
      vi.unstubAllGlobals();
    });
  });
});
