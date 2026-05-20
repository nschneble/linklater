import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import AccountSettingsForm from './AccountSettingsForm';
import type { User } from '../../auth/AuthContext';

import { ApiError } from '../../lib/api';

vi.mock('../../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api')>();
  return {
    ...actual,
    requestEmailChange: vi.fn(),
    setPassword: vi.fn(),
    updateMe: vi.fn(),
  };
});

vi.mock('../../auth/AuthContext', () => ({
  useAuth: vi.fn(),
}));

import * as apiModule from '../../lib/api';
import { useAuth } from '../../auth/AuthContext';

const NEW_PASSWORD = 'super-secret-password-123';

const USER_EMAIL = 'email@example.com';
const USER_ID = 'user-1';

function makeUser(overrides: Partial<User> = {}): User {
  return {
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
    refreshUser: vi.fn(),
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

describe('AccountSettingsForm', () => {
  describe('email section', () => {
    it('shows the current email address', () => {
      render(<AccountSettingsForm />);
      expect(screen.getByText(USER_EMAIL)).toBeInTheDocument();
    });

    it('shows Verified badge when email is verified', () => {
      render(<AccountSettingsForm />);
      expect(screen.getByText('Verified')).toBeInTheDocument();
    });

    it('shows Unverified badge when email is not verified', () => {
      vi.mocked(useAuth).mockReturnValue(
        makeAuthContext({ user: makeUser({ emailVerifiedAt: null }) }),
      );
      render(<AccountSettingsForm />);
      expect(screen.getByText('Unverified')).toBeInTheDocument();
    });

    it('shows the resend verification email button when unverified', () => {
      vi.mocked(useAuth).mockReturnValue(
        makeAuthContext({ user: makeUser({ emailVerifiedAt: null }) }),
      );
      render(<AccountSettingsForm />);
      expect(
        screen.getByRole('button', { name: /resend verification email/i }),
      ).toBeInTheDocument();
    });

    it('does not show the resend button when email is verified', () => {
      render(<AccountSettingsForm />);
      expect(
        screen.queryByRole('button', { name: /resend verification email/i }),
      ).not.toBeInTheDocument();
    });

    it('shows pending email alert when a pending email change exists', () => {
      vi.mocked(useAuth).mockReturnValue(
        makeAuthContext({
          user: makeUser({ pendingEmail: 'new@example.com' }),
        }),
      );
      render(<AccountSettingsForm />);
      expect(screen.getByText(/new@example.com/i)).toBeInTheDocument();
    });

    it('sends email change request and shows success message', async () => {
      vi.mocked(apiModule.requestEmailChange).mockResolvedValue(undefined);
      const setPendingEmail = vi.fn();
      vi.mocked(useAuth).mockReturnValue(makeAuthContext({ setPendingEmail }));

      render(<AccountSettingsForm />);
      const emailInput = screen.getByLabelText(/change email/i);
      fireEvent.change(emailInput, { target: { value: 'new@example.com' } });
      fireEvent.click(screen.getByRole('button', { name: /change email/i }));

      await waitFor(() => {
        expect(apiModule.requestEmailChange).toHaveBeenCalledWith(
          'new@example.com',
        );
        expect(setPendingEmail).toHaveBeenCalledWith('new@example.com');
        expect(screen.getByRole('status')).toBeInTheDocument();
      });
    });

    it('shows an error when email change request fails', async () => {
      vi.mocked(apiModule.requestEmailChange).mockRejectedValue(
        new Error('Email already in use'),
      );

      render(<AccountSettingsForm />);
      const emailInput = screen.getByLabelText(/change email/i);
      fireEvent.change(emailInput, {
        target: { value: 'taken@example.com' },
      });
      fireEvent.click(screen.getByRole('button', { name: /change email/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText('Email already in use')).toBeInTheDocument();
      });
    });

    it('shows an error when the server returns 403 (verification code required)', async () => {
      vi.mocked(apiModule.requestEmailChange).mockRejectedValue(
        new ApiError(
          '2FA is enabled — provide a verification code to change your email',
          403,
        ),
      );
      vi.mocked(useAuth).mockReturnValue(
        makeAuthContext({
          user: makeUser({ twoFactorMethod: 'email' }),
        }),
      );

      render(<AccountSettingsForm />);
      const emailInput = screen.getByLabelText(/change email/i);
      fireEvent.change(emailInput, {
        target: { value: 'new@example.com' },
      });
      fireEvent.click(screen.getByRole('button', { name: /change email/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(
          screen.getByText(/provide a verification code/i),
        ).toBeInTheDocument();
      });
    });

    it('shows resend success message when resend email is clicked', async () => {
      const resendVerificationEmail = vi.fn().mockResolvedValue(undefined);
      vi.mocked(useAuth).mockReturnValue(
        makeAuthContext({
          resendVerificationEmail,
          user: makeUser({ emailVerifiedAt: null }),
        }),
      );

      render(<AccountSettingsForm />);
      fireEvent.click(
        screen.getByRole('button', { name: /resend verification email/i }),
      );

      await waitFor(() => {
        expect(screen.getByRole('status')).toBeInTheDocument();
        expect(
          screen.getByText(/verification email sent/i),
        ).toBeInTheDocument();
      });
    });

    it('shows a 2FA code input when the user has 2FA enabled', () => {
      vi.mocked(useAuth).mockReturnValue(
        makeAuthContext({ user: makeUser({ twoFactorMethod: 'totp' }) }),
      );

      render(<AccountSettingsForm />);

      expect(
        screen.getByLabelText(/authenticator or recovery code/i),
      ).toBeInTheDocument();
    });

    it('includes the 2FA code when requesting an email change with 2FA enabled', async () => {
      vi.mocked(apiModule.requestEmailChange).mockResolvedValue(undefined);
      const setPendingEmail = vi.fn();
      vi.mocked(useAuth).mockReturnValue(
        makeAuthContext({
          setPendingEmail,
          user: makeUser({ twoFactorMethod: 'totp' }),
        }),
      );

      render(<AccountSettingsForm />);
      fireEvent.change(screen.getByLabelText(/change email/i), {
        target: { value: 'new@example.com' },
      });
      fireEvent.change(
        screen.getByLabelText(/authenticator or recovery code/i),
        {
          target: { value: '123456' },
        },
      );
      fireEvent.click(screen.getByRole('button', { name: /change email/i }));

      await waitFor(() => {
        expect(apiModule.requestEmailChange).toHaveBeenCalledWith(
          'new@example.com',
          '123456',
        );
      });
    });

    it('shows an error when resend verification email fails', async () => {
      const resendVerificationEmail = vi
        .fn()
        .mockRejectedValue(new Error('Too many requests'));
      vi.mocked(useAuth).mockReturnValue(
        makeAuthContext({
          resendVerificationEmail,
          user: makeUser({ emailVerifiedAt: null }),
        }),
      );

      render(<AccountSettingsForm />);
      fireEvent.click(
        screen.getByRole('button', { name: /resend verification email/i }),
      );

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText('Too many requests')).toBeInTheDocument();
      });
    });
  });

  describe('password section', () => {
    it('does not show the current password field until new password is typed', () => {
      render(<AccountSettingsForm />);
      expect(
        screen.queryByLabelText(/current password/i),
      ).not.toBeInTheDocument();
    });

    it('shows the current password field when a new password is entered', () => {
      render(<AccountSettingsForm />);
      fireEvent.change(screen.getByLabelText(/new password/i), {
        target: { value: 'my-new-password' },
      });

      expect(screen.getByLabelText(/current password/i)).toBeInTheDocument();
    });

    it('updates the password and shows success message', async () => {
      vi.mocked(apiModule.updateMe).mockResolvedValue({
        id: USER_ID,
        email: USER_EMAIL,
      });

      render(<AccountSettingsForm />);
      fireEvent.change(screen.getByLabelText(/new password/i), {
        target: { value: 'new-strong-password-123' },
      });
      fireEvent.change(screen.getByLabelText(/current password/i), {
        target: { value: 'current-password' },
      });
      fireEvent.click(screen.getByRole('button', { name: /update password/i }));

      await waitFor(() => {
        expect(apiModule.updateMe).toHaveBeenCalledWith({
          password: 'new-strong-password-123',
          currentPassword: 'current-password',
        });
        expect(screen.getByRole('status')).toBeInTheDocument();
        expect(screen.getByText('Password updated')).toBeInTheDocument();
      });
    });

    it('shows an error when the password update fails', async () => {
      vi.mocked(apiModule.updateMe).mockRejectedValue(
        new Error('Current password is incorrect'),
      );

      render(<AccountSettingsForm />);
      fireEvent.change(screen.getByLabelText(/new password/i), {
        target: { value: 'new-strong-password-123' },
      });
      fireEvent.change(screen.getByLabelText(/current password/i), {
        target: { value: 'wrong-password' },
      });
      fireEvent.click(screen.getByRole('button', { name: /update password/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(
          screen.getByText('Current password is incorrect'),
        ).toBeInTheDocument();
      });
    });

    it('the Update password button is disabled when new password is empty', () => {
      render(<AccountSettingsForm />);
      expect(
        screen.getByRole('button', { name: /update password/i }),
      ).toBeDisabled();
    });
  });

  describe('aria-describedby on error inputs', () => {
    it('email input gets aria-describedby pointing to the error element when email change fails', async () => {
      vi.mocked(apiModule.requestEmailChange).mockRejectedValue(
        new Error('Email already in use'),
      );

      render(<AccountSettingsForm />);
      const emailInput = screen.getByLabelText(/change email/i);
      fireEvent.change(emailInput, {
        target: { value: 'taken@example.com' },
      });
      fireEvent.click(screen.getByRole('button', { name: /change email/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      expect(emailInput).toHaveAttribute(
        'aria-describedby',
        'account-email-error',
      );
      expect(document.getElementById('account-email-error')).toHaveTextContent(
        'Email already in use',
      );
    });

    it('new password input gets aria-describedby pointing to the error element when update fails', async () => {
      vi.mocked(apiModule.updateMe).mockRejectedValue(
        new Error('Current password is incorrect'),
      );

      render(<AccountSettingsForm />);
      fireEvent.change(screen.getByLabelText(/new password/i), {
        target: { value: 'new-strong-password-123' },
      });
      fireEvent.change(screen.getByLabelText(/current password/i), {
        target: { value: 'wrong-password' },
      });
      fireEvent.click(screen.getByRole('button', { name: /update password/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      expect(screen.getByLabelText(/new password/i)).toHaveAttribute(
        'aria-describedby',
        'account-password-error',
      );
      expect(
        document.getElementById('account-password-error'),
      ).toHaveTextContent('Current password is incorrect');
    });

    it('email input does not have aria-describedby when there is no error', () => {
      render(<AccountSettingsForm />);
      expect(screen.getByLabelText(/change email/i)).not.toHaveAttribute(
        'aria-describedby',
      );
    });

    it('new password input does not have aria-describedby when there is no error', () => {
      render(<AccountSettingsForm />);
      expect(screen.getByLabelText(/new password/i)).not.toHaveAttribute(
        'aria-describedby',
      );
    });
  });

  describe('add password section (SSO-only account)', () => {
    beforeEach(() => {
      vi.mocked(useAuth).mockReturnValue(
        makeAuthContext({ user: makeUser({ hasPassword: false }) }),
      );
    });

    it('shows the add password form when hasPassword is false', () => {
      render(<AccountSettingsForm />);
      expect(
        screen.getByRole('button', { name: /add password/i }),
      ).toBeInTheDocument();
    });

    it('does not show the update password form when hasPassword is false', () => {
      render(<AccountSettingsForm />);
      expect(
        screen.queryByRole('button', { name: /update password/i }),
      ).not.toBeInTheDocument();
    });

    it('calls setPassword and refreshUser on successful submission', async () => {
      const refreshUser = vi.fn();
      vi.mocked(useAuth).mockReturnValue(
        makeAuthContext({
          user: makeUser({ hasPassword: false }),
          refreshUser,
        }),
      );
      vi.mocked(apiModule.setPassword).mockResolvedValue(undefined);

      render(<AccountSettingsForm />);
      fireEvent.change(screen.getByLabelText(/new password/i), {
        target: { value: NEW_PASSWORD },
      });
      await screen.findByDisplayValue(NEW_PASSWORD);
      fireEvent.click(screen.getByRole('button', { name: /add password/i }));

      await waitFor(() => {
        expect(apiModule.setPassword).toHaveBeenCalledWith(NEW_PASSWORD);
        expect(refreshUser).toHaveBeenCalled();
      });
    });

    it('shows an error alert when setPassword fails', async () => {
      vi.mocked(apiModule.setPassword).mockRejectedValue(
        new Error('Account already has a password'),
      );

      render(<AccountSettingsForm />);
      fireEvent.change(screen.getByLabelText(/new password/i), {
        target: { value: NEW_PASSWORD },
      });
      await screen.findByDisplayValue(NEW_PASSWORD);
      fireEvent.click(screen.getByRole('button', { name: /add password/i }));

      await waitFor(() => {
        expect(
          screen.getByText('Account already has a password'),
        ).toBeInTheDocument();
      });
    });
  });
});
