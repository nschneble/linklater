import {
  act,
  render,
  screen,
  waitFor,
  fireEvent,
} from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import IdPsSection from '.';
import type { User } from '../../../auth/AuthContext';

vi.mock('../../../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/api')>();
  return {
    ...actual,
    initiateOAuthLink: vi.fn(),
    unlinkOAuthProvider: vi.fn(),
  };
});

vi.mock('../../../auth/AuthContext', () => ({
  useAuth: vi.fn(),
}));

import * as apiModule from '../../../lib/api';
import { useAuth } from '../../../auth/AuthContext';

const USER_ID = 'user-1';
const USER_EMAIL = 'user@example.com';

const googleConnection = {
  provider: 'google',
  providerEmail: USER_EMAIL,
  connectedAt: '2026-01-01T00:00:00.000Z',
};

const appleConnection = {
  provider: 'apple',
  providerEmail: USER_EMAIL,
  connectedAt: '2026-01-01T00:00:00.000Z',
};

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
    welcomedAt: null,
    ...overrides,
  };
}

function makeAuthContext(overrides = {}) {
  return {
    loading: false,
    login: vi.fn(),
    loginWithToken: vi.fn(),
    logout: vi.fn(),
    markWelcomed: vi.fn(),
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

describe('IdPsSection', () => {
  describe('Google', () => {
    it('shows a Connect button when Google is enabled and not connected', () => {
      render(<IdPsSection googleEnabled />);
      expect(
        screen.getByRole('button', { name: /connect google/i }),
      ).toBeInTheDocument();
    });

    it('fetches the OAuth URL and navigates the browser when Connect Google is clicked', async () => {
      const assignMock = vi.fn();
      const originalLocation = window.location;
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: { ...originalLocation, assign: assignMock },
        writable: true,
      });
      vi.mocked(apiModule.initiateOAuthLink).mockResolvedValue({
        url: 'https://accounts.google.com/o/oauth2/v2/auth?x=1',
      });

      try {
        render(<IdPsSection googleEnabled />);
        await act(async () => {
          fireEvent.click(
            screen.getByRole('button', { name: /connect google/i }),
          );
        });

        await waitFor(() => {
          expect(apiModule.initiateOAuthLink).toHaveBeenCalledWith('google');
          expect(assignMock).toHaveBeenCalledWith(
            'https://accounts.google.com/o/oauth2/v2/auth?x=1',
          );
        });
      } finally {
        Object.defineProperty(window, 'location', {
          configurable: true,
          value: originalLocation,
          writable: true,
        });
      }
    });

    it('shows an error alert when the OAuth URL request fails', async () => {
      vi.mocked(apiModule.initiateOAuthLink).mockRejectedValue(
        new Error('Unauthorized'),
      );

      render(<IdPsSection googleEnabled />);
      await act(async () => {
        fireEvent.click(
          screen.getByRole('button', { name: /connect google/i }),
        );
      });

      await waitFor(() => {
        expect(screen.getByText(/unauthorized/i)).toBeInTheDocument();
      });
    });

    it('shows connected state when Google is in connectedProviders', () => {
      vi.mocked(useAuth).mockReturnValue(
        makeAuthContext({
          user: makeUser({ connectedProviders: [googleConnection] }),
        }),
      );

      render(<IdPsSection googleEnabled />);

      expect(
        screen.queryByRole('button', { name: /^connect google$/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /disconnect google/i }),
      ).toBeInTheDocument();
    });

    it('renders the provider email under the provider name when connected', () => {
      vi.mocked(useAuth).mockReturnValue(
        makeAuthContext({
          user: makeUser({
            connectedProviders: [
              { ...googleConnection, providerEmail: 'nick@gmail.com' },
            ],
          }),
        }),
      );

      render(<IdPsSection googleEnabled />);

      expect(screen.getByText('nick@gmail.com')).toBeInTheDocument();
      expect(
        screen.getByText((_, element) =>
          Boolean(
            element?.classList?.contains('sr-only') &&
            /^Connected as\s*$/.test(element.textContent ?? ''),
          ),
        ),
      ).toBeInTheDocument();
    });

    it('includes the provider email in the Disconnect button accessible name', () => {
      vi.mocked(useAuth).mockReturnValue(
        makeAuthContext({
          user: makeUser({
            connectedProviders: [
              { ...googleConnection, providerEmail: 'nick@gmail.com' },
            ],
          }),
        }),
      );

      render(<IdPsSection googleEnabled />);

      expect(
        screen.getByRole('button', {
          name: /disconnect google \(nick@gmail\.com\)/i,
        }),
      ).toBeInTheDocument();
    });

    it('disables Disconnect when the user has no password', () => {
      vi.mocked(useAuth).mockReturnValue(
        makeAuthContext({
          user: makeUser({
            hasPassword: false,
            connectedProviders: [googleConnection],
          }),
        }),
      );

      render(<IdPsSection googleEnabled />);

      expect(
        screen.getByRole('button', { name: /disconnect google/i }),
      ).toBeDisabled();
    });

    it('exposes the disconnect-disabled reason via aria-describedby and visible text', () => {
      vi.mocked(useAuth).mockReturnValue(
        makeAuthContext({
          user: makeUser({
            hasPassword: false,
            connectedProviders: [googleConnection],
          }),
        }),
      );

      render(<IdPsSection googleEnabled />);

      const button = screen.getByRole('button', { name: /disconnect google/i });
      expect(button).toHaveAttribute(
        'aria-describedby',
        'disconnect-google-reason',
      );
      expect(button).not.toHaveAttribute('title');
      expect(
        document.getElementById('disconnect-google-reason'),
      ).toHaveTextContent(/add a password first/i);
    });

    it('shows inline confirm when Disconnect is clicked', () => {
      vi.mocked(useAuth).mockReturnValue(
        makeAuthContext({
          user: makeUser({ connectedProviders: [googleConnection] }),
        }),
      );

      render(<IdPsSection googleEnabled />);
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
          user: makeUser({ connectedProviders: [googleConnection] }),
        }),
      );

      render(<IdPsSection googleEnabled />);

      await act(async () => {
        fireEvent.click(
          screen.getByRole('button', { name: /disconnect google/i }),
        );
      });

      await waitFor(() => {
        expect(document.activeElement).toBe(
          screen.getByRole('button', { name: /confirm disconnect google/i }),
        );
      });
    });

    it('hides the confirm when Cancel is clicked', () => {
      vi.mocked(useAuth).mockReturnValue(
        makeAuthContext({
          user: makeUser({ connectedProviders: [googleConnection] }),
        }),
      );

      render(<IdPsSection googleEnabled />);
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
          user: makeUser({ connectedProviders: [googleConnection] }),
        }),
      );
      vi.mocked(apiModule.unlinkOAuthProvider).mockResolvedValue(undefined);

      render(<IdPsSection googleEnabled />);
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
          user: makeUser({ connectedProviders: [googleConnection] }),
        }),
      );
      vi.mocked(apiModule.unlinkOAuthProvider).mockRejectedValue(
        new Error('Disconnect failed'),
      );

      render(<IdPsSection googleEnabled />);
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
      render(<IdPsSection googleEnabled={false} />);
      expect(screen.queryByText(/google/i)).not.toBeInTheDocument();
    });
  });

  describe('Update account email affordance', () => {
    it('does not render the affordance when providerEmail matches the account email', () => {
      vi.mocked(useAuth).mockReturnValue(
        makeAuthContext({
          user: makeUser({ connectedProviders: [googleConnection] }),
        }),
      );

      render(<IdPsSection googleEnabled onUpdateAccountEmailTo={vi.fn()} />);

      expect(
        screen.queryByRole('button', { name: /use .* instead/i }),
      ).not.toBeInTheDocument();
    });

    it('renders an "Use … instead" button when providerEmail differs from account email', () => {
      vi.mocked(useAuth).mockReturnValue(
        makeAuthContext({
          user: makeUser({
            connectedProviders: [
              { ...googleConnection, providerEmail: 'nick@gmail.com' },
            ],
          }),
        }),
      );

      render(<IdPsSection googleEnabled onUpdateAccountEmailTo={vi.fn()} />);

      expect(
        screen.getByRole('button', {
          name: /use nick@gmail\.com as your account email/i,
        }),
      ).toBeInTheDocument();
    });

    it('calls onUpdateAccountEmailTo with the provider email when clicked', () => {
      const onUpdateAccountEmailTo = vi.fn();
      vi.mocked(useAuth).mockReturnValue(
        makeAuthContext({
          user: makeUser({
            connectedProviders: [
              { ...googleConnection, providerEmail: 'nick@gmail.com' },
            ],
          }),
        }),
      );

      render(
        <IdPsSection
          googleEnabled
          onUpdateAccountEmailTo={onUpdateAccountEmailTo}
        />,
      );

      fireEvent.click(
        screen.getByRole('button', {
          name: /use nick@gmail\.com as your account email/i,
        }),
      );

      expect(onUpdateAccountEmailTo).toHaveBeenCalledWith('nick@gmail.com');
    });

    it('does not render the affordance when onUpdateAccountEmailTo is omitted', () => {
      vi.mocked(useAuth).mockReturnValue(
        makeAuthContext({
          user: makeUser({
            connectedProviders: [
              { ...googleConnection, providerEmail: 'nick@gmail.com' },
            ],
          }),
        }),
      );

      render(<IdPsSection googleEnabled />);

      expect(
        screen.queryByRole('button', { name: /use .* instead/i }),
      ).not.toBeInTheDocument();
    });
  });

  describe('Apple', () => {
    it('calls unlinkOAuthProvider and refreshUser when Apple disconnect is confirmed', async () => {
      const refreshUser = vi.fn().mockResolvedValue(undefined);
      vi.mocked(useAuth).mockReturnValue(
        makeAuthContext({
          refreshUser,
          user: makeUser({ connectedProviders: [appleConnection] }),
        }),
      );
      vi.mocked(apiModule.unlinkOAuthProvider).mockResolvedValue(undefined);

      render(<IdPsSection appleEnabled />);
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
          user: makeUser({ connectedProviders: [appleConnection] }),
        }),
      );

      render(<IdPsSection appleEnabled />);

      expect(
        screen.getByRole('button', { name: /disconnect apple/i }),
      ).toBeInTheDocument();
    });

    it('does not show Apple section when appleEnabled is false', () => {
      render(<IdPsSection appleEnabled={false} />);
      expect(screen.queryByText(/apple/i)).not.toBeInTheDocument();
    });
  });

  describe('flash messages', () => {
    it('shows linkedMessage as a success alert', () => {
      render(
        <IdPsSection googleEnabled linkedMessage="Google account connected" />,
      );
      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText('Google account connected')).toBeInTheDocument();
    });

    it('shows linkError as an error alert', () => {
      render(
        <IdPsSection
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
