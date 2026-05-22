import {
  act,
  render,
  screen,
  waitFor,
  fireEvent,
} from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import SocialLoginsSection from './SocialLoginsSection';
import type { User } from '../../auth/AuthContext';

vi.mock('../../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api')>();
  return {
    ...actual,
    unlinkOAuthProvider: vi.fn(),
  };
});

vi.mock('../../auth/AuthContext', () => ({
  useAuth: vi.fn(),
}));

import * as apiModule from '../../lib/api';
import { useAuth } from '../../auth/AuthContext';

const USER_ID = 'user-1';
const USER_EMAIL = 'user@example.com';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    cvdMode: false,
    connectedProviders: [],
    email: USER_EMAIL,
    emailVerifiedAt: '2026-01-01T00:00:00.000Z',
    hasPassword: true,
    mode: 'light',
    pendingEmail: null,
    theme: 'scanner-darkly',
    twoFactorMethod: null,
    twoFactorPending: false,
    userId: USER_ID,
    ...overrides,
  };
}

function makeAuthContext(overrides = {}) {
  return {
    loading: false,
    login: vi.fn(),
    loginWithToken: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn().mockResolvedValue(undefined),
    register: vi.fn(),
    resendVerificationEmail: vi.fn(),
    setPendingEmail: vi.fn(),
    user: makeUser(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(useAuth).mockReturnValue(makeAuthContext());
});

afterEach(() => vi.restoreAllMocks());

describe('SocialLoginsSection', () => {
  describe('Google', () => {
    it('shows a Connect button when Google is enabled and not connected', () => {
      render(<SocialLoginsSection googleEnabled />);
      expect(
        screen.getByRole('button', { name: /connect google/i }),
      ).toBeInTheDocument();
    });

    it('shows connected state when Google is in connectedProviders', () => {
      vi.mocked(useAuth).mockReturnValue(
        makeAuthContext({
          user: makeUser({
            connectedProviders: [
              { provider: 'google', connectedAt: '2026-01-01T00:00:00.000Z' },
            ],
          }),
        }),
      );

      render(<SocialLoginsSection googleEnabled />);

      expect(
        screen.queryByRole('button', { name: /^connect google$/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /disconnect google/i }),
      ).toBeInTheDocument();
    });

    it('disables Disconnect when the user has no password', () => {
      vi.mocked(useAuth).mockReturnValue(
        makeAuthContext({
          user: makeUser({
            hasPassword: false,
            connectedProviders: [
              { provider: 'google', connectedAt: '2026-01-01T00:00:00.000Z' },
            ],
          }),
        }),
      );

      render(<SocialLoginsSection googleEnabled />);

      expect(
        screen.getByRole('button', { name: /disconnect google/i }),
      ).toBeDisabled();
    });

    it('shows inline confirm when Disconnect is clicked', () => {
      vi.mocked(useAuth).mockReturnValue(
        makeAuthContext({
          user: makeUser({
            connectedProviders: [
              { provider: 'google', connectedAt: '2026-01-01T00:00:00.000Z' },
            ],
          }),
        }),
      );

      render(<SocialLoginsSection googleEnabled />);
      fireEvent.click(
        screen.getByRole('button', { name: /disconnect google/i }),
      );

      expect(
        screen.getByRole('button', { name: /confirm disconnect google/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /cancel disconnect google/i }),
      ).toBeInTheDocument();
    });

    it('focuses the confirm button after clicking Disconnect', async () => {
      vi.mocked(useAuth).mockReturnValue(
        makeAuthContext({
          user: makeUser({
            connectedProviders: [
              { provider: 'google', connectedAt: '2026-01-01T00:00:00.000Z' },
            ],
          }),
        }),
      );

      render(<SocialLoginsSection googleEnabled />);

      await act(async () => {
        fireEvent.click(
          screen.getByRole('button', { name: /disconnect google/i }),
        );
      });

      // Focus is set via requestAnimationFrame — wait for it.
      await waitFor(() => {
        expect(document.activeElement).toBe(
          screen.getByRole('button', { name: /confirm disconnect google/i }),
        );
      });
    });

    it('hides the confirm when Cancel is clicked', () => {
      vi.mocked(useAuth).mockReturnValue(
        makeAuthContext({
          user: makeUser({
            connectedProviders: [
              { provider: 'google', connectedAt: '2026-01-01T00:00:00.000Z' },
            ],
          }),
        }),
      );

      render(<SocialLoginsSection googleEnabled />);
      fireEvent.click(
        screen.getByRole('button', { name: /disconnect google/i }),
      );
      fireEvent.click(
        screen.getByRole('button', { name: /cancel disconnect google/i }),
      );

      expect(
        screen.queryByRole('button', { name: /confirm disconnect google/i }),
      ).not.toBeInTheDocument();
    });

    it('calls unlinkOAuthProvider and refreshUser on confirm', async () => {
      const refreshUser = vi.fn().mockResolvedValue(undefined);
      vi.mocked(useAuth).mockReturnValue(
        makeAuthContext({
          refreshUser,
          user: makeUser({
            connectedProviders: [
              { provider: 'google', connectedAt: '2026-01-01T00:00:00.000Z' },
            ],
          }),
        }),
      );
      vi.mocked(apiModule.unlinkOAuthProvider).mockResolvedValue(undefined);

      render(<SocialLoginsSection googleEnabled />);
      fireEvent.click(
        screen.getByRole('button', { name: /disconnect google/i }),
      );
      fireEvent.click(
        screen.getByRole('button', { name: /confirm disconnect google/i }),
      );

      await waitFor(() => {
        expect(apiModule.unlinkOAuthProvider).toHaveBeenCalledWith('google');
        expect(refreshUser).toHaveBeenCalled();
      });
    });

    it('shows an error when disconnect fails', async () => {
      vi.mocked(useAuth).mockReturnValue(
        makeAuthContext({
          user: makeUser({
            connectedProviders: [
              { provider: 'google', connectedAt: '2026-01-01T00:00:00.000Z' },
            ],
          }),
        }),
      );
      vi.mocked(apiModule.unlinkOAuthProvider).mockRejectedValue(
        new Error('Disconnect failed'),
      );

      render(<SocialLoginsSection googleEnabled />);
      fireEvent.click(
        screen.getByRole('button', { name: /disconnect google/i }),
      );
      fireEvent.click(
        screen.getByRole('button', { name: /confirm disconnect google/i }),
      );

      await waitFor(() => {
        expect(screen.getByText('Disconnect failed')).toBeInTheDocument();
      });
    });

    it('does not show Google section when googleEnabled is false', () => {
      render(<SocialLoginsSection googleEnabled={false} />);
      expect(screen.queryByText(/google/i)).not.toBeInTheDocument();
    });
  });

  describe('Apple', () => {
    it('calls unlinkOAuthProvider and refreshUser when Apple disconnect is confirmed', async () => {
      const refreshUser = vi.fn().mockResolvedValue(undefined);
      vi.mocked(useAuth).mockReturnValue(
        makeAuthContext({
          refreshUser,
          user: makeUser({
            connectedProviders: [
              { provider: 'apple', connectedAt: '2026-01-01T00:00:00.000Z' },
            ],
          }),
        }),
      );
      vi.mocked(apiModule.unlinkOAuthProvider).mockResolvedValue(undefined);

      render(<SocialLoginsSection appleEnabled />);
      fireEvent.click(
        screen.getByRole('button', { name: /disconnect apple/i }),
      );
      fireEvent.click(
        screen.getByRole('button', { name: /confirm disconnect apple/i }),
      );

      await waitFor(() => {
        expect(apiModule.unlinkOAuthProvider).toHaveBeenCalledWith('apple');
        expect(refreshUser).toHaveBeenCalled();
      });
    });

    it('shows Apple connected state when Apple is in connectedProviders', () => {
      vi.mocked(useAuth).mockReturnValue(
        makeAuthContext({
          user: makeUser({
            connectedProviders: [
              { provider: 'apple', connectedAt: '2026-01-01T00:00:00.000Z' },
            ],
          }),
        }),
      );

      render(<SocialLoginsSection appleEnabled />);

      expect(
        screen.getByRole('button', { name: /disconnect apple/i }),
      ).toBeInTheDocument();
    });

    it('does not show Apple section when appleEnabled is false', () => {
      render(<SocialLoginsSection appleEnabled={false} />);
      expect(screen.queryByText(/apple/i)).not.toBeInTheDocument();
    });
  });

  describe('flash messages', () => {
    it('shows linkedMessage as a success alert', () => {
      render(
        <SocialLoginsSection
          googleEnabled
          linkedMessage="Google account connected"
        />,
      );
      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText('Google account connected')).toBeInTheDocument();
    });

    it('shows linkError as an error alert', () => {
      render(
        <SocialLoginsSection
          googleEnabled
          linkError="That Google account is already linked to another user"
        />,
      );
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(
        screen.getByText(
          'That Google account is already linked to another user',
        ),
      ).toBeInTheDocument();
    });
  });
});
