import {
  render,
  screen,
  waitFor,
  fireEvent,
  act,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import AuthForm from './AuthForm';

vi.mock('../../lib/api', () => ({
  forgotPassword: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
  getMe: vi.fn(),
  getStoredToken: vi.fn().mockReturnValue(null),
  registerMagicLink: vi.fn(),
  requestMagicLink: vi.fn(),
  verifyOtp: vi.fn(),
}));

vi.mock('../../auth/AuthContext', () => ({
  useAuth: vi.fn(),
}));

import * as apiModule from '../../lib/api';
import { useAuth } from '../../auth/AuthContext';

const { registerMagicLink, requestMagicLink, verifyOtp } = apiModule;

const USER_EMAIL = 'email@example.com';
const USER_PASSWORD = 'strong-password-123';

function renderAuthForm() {
  return render(
    <MemoryRouter>
      <AuthForm />
    </MemoryRouter>,
  );
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
    user: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useAuth).mockReturnValue(makeAuthContext());
});

function fillEmail(email: string) {
  fireEvent.change(screen.getByLabelText(/email/i), {
    target: { value: email },
  });
}

function fillPassword(password: string) {
  fireEvent.change(screen.getByLabelText(/password/i), {
    target: { value: password },
  });
}

describe('AuthForm', () => {
  describe('login mode', () => {
    it('renders login form by default', () => {
      renderAuthForm();
      expect(screen.getByRole('tab', { name: /log in/i })).toHaveAttribute(
        'aria-selected',
        'true',
      );
    });

    it('calls login with email and password on submit', async () => {
      const loginMock = vi.fn().mockResolvedValue(undefined);
      vi.mocked(useAuth).mockReturnValue(makeAuthContext({ login: loginMock }));

      renderAuthForm();
      fillEmail(USER_EMAIL);
      fillPassword(USER_PASSWORD);
      fireEvent.click(screen.getByRole('button', { name: /^log in$/i }));

      await waitFor(() => {
        expect(loginMock).toHaveBeenCalledWith(USER_EMAIL, USER_PASSWORD);
      });
    });

    it('shows an error message when login fails', async () => {
      const loginMock = vi
        .fn()
        .mockRejectedValue(new Error('Invalid email or password'));
      vi.mocked(useAuth).mockReturnValue(makeAuthContext({ login: loginMock }));

      renderAuthForm();
      fillEmail(USER_EMAIL);
      fillPassword(USER_PASSWORD);
      fireEvent.click(screen.getByRole('button', { name: /^log in$/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(
          screen.getByText(/invalid email or password/i),
        ).toBeInTheDocument();
      });
    });

    it('shows a fallback error when login throws a non-Error', async () => {
      const loginMock = vi.fn().mockRejectedValue('unknown');
      vi.mocked(useAuth).mockReturnValue(makeAuthContext({ login: loginMock }));

      renderAuthForm();
      fillEmail(USER_EMAIL);
      fillPassword(USER_PASSWORD);
      fireEvent.click(screen.getByRole('button', { name: /^log in$/i }));

      await waitFor(() => {
        expect(
          screen.getByText(/something went dreadfully wrong/i),
        ).toBeInTheDocument();
      });
    });

    it('shows the forgot password link', () => {
      renderAuthForm();
      expect(
        screen.getByRole('button', { name: /literally have no idea/i }),
      ).toBeInTheDocument();
    });

    it('focuses the email field by default', () => {
      renderAuthForm();

      expect(screen.getByLabelText(/email/i)).toHaveFocus();
    });
  });

  describe('register mode', () => {
    it('switches to register mode when Sign up tab is clicked', () => {
      renderAuthForm();
      fireEvent.click(screen.getByRole('tab', { name: /sign up/i }));

      expect(screen.getByRole('tab', { name: /sign up/i })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      // With no password entered, the button defaults to magic link sign-up
      expect(
        screen.getByRole('button', { name: /sign up with magic link/i }),
      ).toBeInTheDocument();
    });

    it('shows "Create account" button when a password is typed in register mode', () => {
      renderAuthForm();
      fireEvent.click(screen.getByRole('tab', { name: /sign up/i }));
      fillPassword(USER_PASSWORD);

      expect(
        screen.getByRole('button', { name: /create account/i }),
      ).toBeInTheDocument();
    });

    it('focuses the password field when switching modes after email is entered', () => {
      renderAuthForm();
      fillEmail(USER_EMAIL);
      fireEvent.click(screen.getByRole('tab', { name: /sign up/i }));

      expect(screen.getByLabelText(/password/i)).toHaveFocus();
    });

    it('calls register with email and password on submit', async () => {
      const registerMock = vi.fn().mockResolvedValue(undefined);
      vi.mocked(useAuth).mockReturnValue(
        makeAuthContext({ register: registerMock }),
      );

      renderAuthForm();
      fireEvent.click(screen.getByRole('tab', { name: /sign up/i }));
      fillEmail(USER_EMAIL);
      fillPassword(USER_PASSWORD);
      fireEvent.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(() => {
        expect(registerMock).toHaveBeenCalledWith(USER_EMAIL, USER_PASSWORD);
      });
    });

    it('shows an error when registration fails', async () => {
      const registerMock = vi
        .fn()
        .mockRejectedValue(new Error('Email already in use'));
      vi.mocked(useAuth).mockReturnValue(
        makeAuthContext({ register: registerMock }),
      );

      renderAuthForm();
      fireEvent.click(screen.getByRole('tab', { name: /sign up/i }));
      fillEmail(USER_EMAIL);
      fillPassword(USER_PASSWORD);
      fireEvent.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText(/email already in use/i)).toBeInTheDocument();
      });
    });

    it('clears error when switching modes', async () => {
      const registerMock = vi
        .fn()
        .mockRejectedValue(new Error('Email already in use'));
      vi.mocked(useAuth).mockReturnValue(
        makeAuthContext({ register: registerMock }),
      );

      renderAuthForm();
      fireEvent.click(screen.getByRole('tab', { name: /sign up/i }));
      fillEmail(USER_EMAIL);
      fillPassword(USER_PASSWORD);
      fireEvent.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      act(() => {
        fireEvent.click(screen.getByRole('tab', { name: /log in/i }));
      });
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('forgot password mode', () => {
    it('shows the forgot password form when the link is clicked', () => {
      renderAuthForm();
      fireEvent.click(
        screen.getByRole('button', { name: /literally have no idea/i }),
      );

      expect(screen.getByText(/silly goose/i)).toBeInTheDocument();
    });

    it('sends forgot password email and shows success message', async () => {
      vi.mocked(apiModule.forgotPassword).mockResolvedValue(undefined);

      renderAuthForm();
      fireEvent.click(
        screen.getByRole('button', { name: /literally have no idea/i }),
      );
      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: USER_EMAIL },
      });
      fireEvent.click(
        screen.getByRole('button', { name: /send password reset link/i }),
      );

      await waitFor(() => {
        expect(screen.getByRole('status')).toBeInTheDocument();
        expect(screen.getByText(/check your email/i)).toBeInTheDocument();
      });
    });

    it('shows an error when forgot password fails', async () => {
      vi.mocked(apiModule.forgotPassword).mockRejectedValue(
        new Error('Service unavailable'),
      );

      renderAuthForm();
      fireEvent.click(
        screen.getByRole('button', { name: /literally have no idea/i }),
      );
      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: USER_EMAIL },
      });
      fireEvent.click(
        screen.getByRole('button', { name: /send password reset link/i }),
      );

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText(/service unavailable/i)).toBeInTheDocument();
      });
    });

    it('returns to login when Back to login is clicked from the success state', async () => {
      vi.mocked(apiModule.forgotPassword).mockResolvedValue(undefined);

      renderAuthForm();
      fireEvent.click(
        screen.getByRole('button', { name: /literally have no idea/i }),
      );
      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: USER_EMAIL },
      });
      fireEvent.click(
        screen.getByRole('button', { name: /send password reset link/i }),
      );

      await waitFor(() => {
        expect(screen.getByText(/check your email/i)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /back to login/i }));

      expect(screen.getByRole('tab', { name: /log in/i })).toBeInTheDocument();
    });
  });

  describe('MFA challenge — TOTP', () => {
    it('shows TOTP code input when login returns mfaToken with method totp', async () => {
      const loginMock = vi.fn().mockResolvedValue({
        mfaToken: 'mfa-tok',
        mfaMethod: 'totp',
      });
      vi.mocked(useAuth).mockReturnValue(makeAuthContext({ login: loginMock }));

      renderAuthForm();
      fillEmail(USER_EMAIL);
      fillPassword(USER_PASSWORD);

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /^log in$/i }));
      });

      await waitFor(() => {
        expect(
          screen.getByLabelText(/authenticator code/i),
        ).toBeInTheDocument();
      });
    });

    it('verifies TOTP code and completes login on success', async () => {
      const loginMock = vi.fn().mockResolvedValue({
        mfaToken: 'mfa-tok',
        mfaMethod: 'totp',
      });
      const refreshUser = vi.fn().mockResolvedValue(undefined);
      vi.mocked(useAuth).mockReturnValue(
        makeAuthContext({ login: loginMock, refreshUser }),
      );
      vi.mocked(verifyOtp).mockResolvedValue({ accessToken: 'full-jwt' });

      renderAuthForm();
      fillEmail(USER_EMAIL);
      fillPassword(USER_PASSWORD);

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /^log in$/i }));
      });

      await waitFor(() => {
        expect(
          screen.getByLabelText(/authenticator code/i),
        ).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText(/authenticator code/i), {
        target: { value: '123456' },
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /verify/i }));
      });

      await waitFor(() => {
        expect(verifyOtp).toHaveBeenCalledWith('mfa-tok', '123456', 'totp');
        expect(refreshUser).toHaveBeenCalled();
      });
    });

    it('shows a Use recovery code link for TOTP', async () => {
      const loginMock = vi.fn().mockResolvedValue({
        mfaToken: 'mfa-tok',
        mfaMethod: 'totp',
      });
      vi.mocked(useAuth).mockReturnValue(makeAuthContext({ login: loginMock }));

      renderAuthForm();
      fillEmail(USER_EMAIL);
      fillPassword(USER_PASSWORD);

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /^log in$/i }));
      });

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /use a recovery code/i }),
        ).toBeInTheDocument();
      });
    });
  });

  describe('magic link (no password)', () => {
    it('shows "Log in with magic link" button when password field is empty', () => {
      renderAuthForm();
      fillEmail(USER_EMAIL);

      expect(
        screen.getByRole('button', { name: /log in with magic link/i }),
      ).toBeInTheDocument();
    });

    it('calls requestMagicLink with email when submitted with no password', async () => {
      vi.mocked(requestMagicLink).mockResolvedValue(undefined);

      renderAuthForm();
      fillEmail(USER_EMAIL);

      await act(async () => {
        fireEvent.click(
          screen.getByRole('button', { name: /log in with magic link/i }),
        );
      });

      await waitFor(() => {
        expect(requestMagicLink).toHaveBeenCalledWith(USER_EMAIL);
      });
    });

    it('shows an inline success alert while keeping the form visible', async () => {
      vi.mocked(requestMagicLink).mockResolvedValue(undefined);

      renderAuthForm();
      fillEmail(USER_EMAIL);

      await act(async () => {
        fireEvent.click(
          screen.getByRole('button', { name: /log in with magic link/i }),
        );
      });

      await waitFor(() => {
        expect(screen.getByRole('status')).toBeInTheDocument();
        expect(
          screen.getByText(/check your email for a login link/i),
        ).toBeInTheDocument();
        expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
      });
    });

    it('shows an error when requestMagicLink fails', async () => {
      vi.mocked(requestMagicLink).mockRejectedValue(
        new Error('Service unavailable'),
      );

      renderAuthForm();
      fillEmail(USER_EMAIL);

      await act(async () => {
        fireEvent.click(
          screen.getByRole('button', { name: /log in with magic link/i }),
        );
      });

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText(/service unavailable/i)).toBeInTheDocument();
      });
    });
  });

  describe('register mode — magic link (no password)', () => {
    it('shows "Sign up with magic link" button in register mode when password field is empty', () => {
      renderAuthForm();
      fireEvent.click(screen.getByRole('tab', { name: /sign up/i }));

      expect(
        screen.getByRole('button', { name: /sign up with magic link/i }),
      ).toBeInTheDocument();
    });

    it('calls registerMagicLink with email when submitted with no password in register mode', async () => {
      vi.mocked(registerMagicLink).mockResolvedValue(undefined);

      renderAuthForm();
      fireEvent.click(screen.getByRole('tab', { name: /sign up/i }));
      fillEmail(USER_EMAIL);

      await act(async () => {
        fireEvent.click(
          screen.getByRole('button', { name: /sign up with magic link/i }),
        );
      });

      await waitFor(() => {
        expect(registerMagicLink).toHaveBeenCalledWith(USER_EMAIL);
      });
    });

    it('shows "Check your email to finish signing up!" after successful registerMagicLink', async () => {
      vi.mocked(registerMagicLink).mockResolvedValue(undefined);

      renderAuthForm();
      fireEvent.click(screen.getByRole('tab', { name: /sign up/i }));
      fillEmail(USER_EMAIL);

      await act(async () => {
        fireEvent.click(
          screen.getByRole('button', { name: /sign up with magic link/i }),
        );
      });

      await waitFor(() => {
        expect(screen.getByRole('status')).toBeInTheDocument();
        expect(
          screen.getByText(/check your email to finish signing up/i),
        ).toBeInTheDocument();
      });
    });

    it('shows "Log in with magic link" (not "Sign up") when in login mode with no password', () => {
      renderAuthForm();
      fillEmail(USER_EMAIL);

      expect(
        screen.getByRole('button', { name: /log in with magic link/i }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /sign up with magic link/i }),
      ).not.toBeInTheDocument();
    });
  });

  describe('MFA challenge — recovery code', () => {
    it('switches to recovery code input when Use a recovery code is clicked', async () => {
      const loginMock = vi.fn().mockResolvedValue({
        mfaToken: 'mfa-tok',
        mfaMethod: 'totp',
      });
      vi.mocked(useAuth).mockReturnValue(makeAuthContext({ login: loginMock }));

      renderAuthForm();
      fillEmail(USER_EMAIL);
      fillPassword(USER_PASSWORD);

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /^log in$/i }));
      });

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /use a recovery code/i }),
        ).toBeInTheDocument();
      });

      fireEvent.click(
        screen.getByRole('button', { name: /use a recovery code/i }),
      );

      expect(screen.getByLabelText(/recovery code/i)).toBeInTheDocument();
    });
  });
});
