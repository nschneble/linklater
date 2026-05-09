import {
  render,
  screen,
  waitFor,
  fireEvent,
  act,
} from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import AuthForm from './AuthForm';

vi.mock('../lib/api', () => ({
  forgotPassword: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
  getMe: vi.fn(),
  getStoredToken: vi.fn().mockReturnValue(null),
}));

vi.mock('../auth/AuthContext', () => ({
  useAuth: vi.fn(),
}));

import * as apiModule from '../lib/api';
import { useAuth } from '../auth/AuthContext';

const USER_EMAIL = 'email@example.com';
const USER_PASSWORD = 'strong-password-123';

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

beforeEach(() => {
  vi.mocked(useAuth).mockReturnValue(makeAuthContext());
});

afterEach(() => vi.restoreAllMocks());

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
      render(<AuthForm />);
      expect(screen.getByRole('tab', { name: /log in/i })).toHaveAttribute(
        'aria-selected',
        'true',
      );
    });

    it('calls login with email and password on submit', async () => {
      const loginMock = vi.fn().mockResolvedValue(undefined);
      vi.mocked(useAuth).mockReturnValue(makeAuthContext({ login: loginMock }));

      render(<AuthForm />);
      fillEmail(USER_EMAIL);
      fillPassword(USER_PASSWORD);
      fireEvent.click(screen.getByRole('button', { name: /log in/i }));

      await waitFor(() => {
        expect(loginMock).toHaveBeenCalledWith(USER_EMAIL, USER_PASSWORD);
      });
    });

    it('shows an error message when login fails', async () => {
      const loginMock = vi
        .fn()
        .mockRejectedValue(new Error('Invalid email or password'));
      vi.mocked(useAuth).mockReturnValue(makeAuthContext({ login: loginMock }));

      render(<AuthForm />);
      fillEmail(USER_EMAIL);
      fillPassword(USER_PASSWORD);
      fireEvent.click(screen.getByRole('button', { name: /log in/i }));

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

      render(<AuthForm />);
      fillEmail(USER_EMAIL);
      fillPassword(USER_PASSWORD);
      fireEvent.click(screen.getByRole('button', { name: /log in/i }));

      await waitFor(() => {
        expect(
          screen.getByText(/something went dreadfully wrong/i),
        ).toBeInTheDocument();
      });
    });

    it('shows the forgot password link', () => {
      render(<AuthForm />);
      expect(
        screen.getByRole('button', { name: /literally have no idea/i }),
      ).toBeInTheDocument();
    });
  });

  describe('register mode', () => {
    it('switches to register mode when Sign up tab is clicked', () => {
      render(<AuthForm />);
      fireEvent.click(screen.getByRole('tab', { name: /sign up/i }));

      expect(screen.getByRole('tab', { name: /sign up/i })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      expect(
        screen.getByRole('button', { name: /create account/i }),
      ).toBeInTheDocument();
    });

    it('calls register with email and password on submit', async () => {
      const registerMock = vi.fn().mockResolvedValue(undefined);
      vi.mocked(useAuth).mockReturnValue(
        makeAuthContext({ register: registerMock }),
      );

      render(<AuthForm />);
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

      render(<AuthForm />);
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

      render(<AuthForm />);
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
      render(<AuthForm />);
      fireEvent.click(
        screen.getByRole('button', { name: /literally have no idea/i }),
      );

      expect(screen.getByText(/silly goose/i)).toBeInTheDocument();
    });

    it('sends forgot password email and shows success message', async () => {
      vi.mocked(apiModule.forgotPassword).mockResolvedValue(undefined);

      render(<AuthForm />);
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

      render(<AuthForm />);
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

      render(<AuthForm />);
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
});
