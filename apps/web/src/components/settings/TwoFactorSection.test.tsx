import {
  render,
  screen,
  waitFor,
  fireEvent,
  act,
} from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import TwoFactorSection from './TwoFactorSection';
import type { User } from '../../auth/AuthContext';

vi.mock('../../lib/api', () => ({
  disable2fa: vi.fn(),
  regenerateRecoveryCodes: vi.fn(),
  sendReauthEmailCode: vi.fn(),
  setupEmailTwoFactor: vi.fn(),
  setupTotp: vi.fn(),
  verifyEmailTwoFactorSetup: vi.fn(),
  verifyTotpSetup: vi.fn(),
}));

vi.mock('../../auth/AuthContext', () => ({
  useAuth: vi.fn(),
}));

import * as apiModule from '../../lib/api';
import { useAuth } from '../../auth/AuthContext';
import type { Mock } from 'vitest';

const USER_ID = 'user-1';
const USER_EMAIL = 'user@example.com';

function makeUser(overrides: Partial<User> = {}): User {
  return {
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
  vi.clearAllMocks();
  vi.mocked(useAuth).mockReturnValue(makeAuthContext());
});

describe('TwoFactorSection', () => {
  describe('State A — 2FA not enabled', () => {
    it('shows setup buttons when 2FA is not enabled', () => {
      render(<TwoFactorSection />);

      expect(
        screen.getByRole('button', { name: /set up authenticator app/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /set up email code/i }),
      ).toBeInTheDocument();
    });

    it('labels TOTP as Recommended', () => {
      render(<TwoFactorSection />);

      expect(screen.getByText(/recommended/i)).toBeInTheDocument();
    });
  });

  describe('State B — TOTP setup in progress', () => {
    it('initiates TOTP setup when the authenticator app button is clicked', async () => {
      vi.mocked(apiModule.setupTotp).mockResolvedValue({
        qrCodeDataUrl: 'data:image/png;base64,abc',
        secret: 'SECRETABC',
      });

      render(<TwoFactorSection />);

      await act(async () => {
        fireEvent.click(
          screen.getByRole('button', { name: /set up authenticator app/i }),
        );
      });

      expect(apiModule.setupTotp).toHaveBeenCalled();
      expect(screen.getByText('SECRETABC')).toBeInTheDocument();
    });

    it('verifies TOTP setup and shows recovery codes on success', async () => {
      vi.mocked(apiModule.setupTotp).mockResolvedValue({
        qrCodeDataUrl: 'data:image/png;base64,abc',
        secret: 'SECRETABC',
      });
      vi.mocked(apiModule.verifyTotpSetup).mockResolvedValue({
        recoveryCodes: ['aaaaa-bbbbb', 'ccccc-ddddd'],
      });

      render(<TwoFactorSection />);

      await act(async () => {
        fireEvent.click(
          screen.getByRole('button', { name: /set up authenticator app/i }),
        );
      });

      const codeInput = screen.getByLabelText(/verification code/i);
      fireEvent.change(codeInput, { target: { value: '123456' } });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /verify/i }));
      });

      await waitFor(() => {
        expect(screen.getByText('aaaaa-bbbbb')).toBeInTheDocument();
      });
    });

    it('shows an error when TOTP verification fails', async () => {
      vi.mocked(apiModule.setupTotp).mockResolvedValue({
        qrCodeDataUrl: 'data:image/png;base64,abc',
        secret: 'SECRETABC',
      });
      vi.mocked(apiModule.verifyTotpSetup).mockRejectedValue(
        new Error('Invalid code'),
      );

      render(<TwoFactorSection />);

      await act(async () => {
        fireEvent.click(
          screen.getByRole('button', { name: /set up authenticator app/i }),
        );
      });

      const codeInput = screen.getByLabelText(/verification code/i);
      fireEvent.change(codeInput, { target: { value: '000000' } });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /verify/i }));
      });

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Invalid code');
      });
    });
  });

  describe('State C — TOTP enabled', () => {
    it('shows enabled status when TOTP is active', () => {
      vi.mocked(useAuth).mockReturnValue(
        makeAuthContext({ user: makeUser({ twoFactorMethod: 'totp' }) }),
      );

      render(<TwoFactorSection />);

      expect(screen.getByText(/enabled/i)).toBeInTheDocument();
    });

    it('shows regenerate and disable links when TOTP is active', () => {
      vi.mocked(useAuth).mockReturnValue(
        makeAuthContext({ user: makeUser({ twoFactorMethod: 'totp' }) }),
      );

      render(<TwoFactorSection />);

      expect(
        screen.getByRole('button', { name: /regenerate recovery codes/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /disable two-factor/i }),
      ).toBeInTheDocument();
    });
  });

  describe('State D — Email 2FA setup in progress', () => {
    it('shows confirmation text when Email 2FA setup is initiated', async () => {
      render(<TwoFactorSection />);

      await act(async () => {
        fireEvent.click(
          screen.getByRole('button', { name: /set up email code/i }),
        );
      });

      expect(screen.getByText(new RegExp(USER_EMAIL, 'i'))).toBeInTheDocument();
    });

    it('sends code and shows code input after send is clicked', async () => {
      vi.mocked(apiModule.setupEmailTwoFactor).mockResolvedValue(undefined);

      render(<TwoFactorSection />);

      await act(async () => {
        fireEvent.click(
          screen.getByRole('button', { name: /set up email code/i }),
        );
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /send code/i }));
      });

      await waitFor(() => {
        expect(screen.getByLabelText(/email code/i)).toBeInTheDocument();
      });
    });
  });

  describe('State E — Email 2FA enabled', () => {
    it('shows enabled status when Email 2FA is active', () => {
      vi.mocked(useAuth).mockReturnValue(
        makeAuthContext({ user: makeUser({ twoFactorMethod: 'email' }) }),
      );

      render(<TwoFactorSection />);

      expect(screen.getByText(/enabled/i)).toBeInTheDocument();
    });

    it('shows a "Send me a code" button in the re-auth form for Email 2FA users', async () => {
      vi.mocked(useAuth).mockReturnValue(
        makeAuthContext({ user: makeUser({ twoFactorMethod: 'email' }) }),
      );
      (apiModule.sendReauthEmailCode as Mock).mockResolvedValue(undefined);

      render(<TwoFactorSection />);

      await act(async () => {
        fireEvent.click(
          screen.getByRole('button', { name: /disable two-factor/i }),
        );
      });

      expect(
        screen.getByRole('button', { name: /send me a code/i }),
      ).toBeInTheDocument();
    });

    it('sends email code and shows confirmation when "Send me a code" is clicked', async () => {
      vi.mocked(useAuth).mockReturnValue(
        makeAuthContext({ user: makeUser({ twoFactorMethod: 'email' }) }),
      );
      (apiModule.sendReauthEmailCode as Mock).mockResolvedValue(undefined);

      render(<TwoFactorSection />);

      await act(async () => {
        fireEvent.click(
          screen.getByRole('button', { name: /disable two-factor/i }),
        );
      });

      await act(async () => {
        fireEvent.click(
          screen.getByRole('button', { name: /send me a code/i }),
        );
      });

      await waitFor(() => {
        expect(apiModule.sendReauthEmailCode).toHaveBeenCalled();
        expect(
          screen.getByText(/code sent to your email/i),
        ).toBeInTheDocument();
      });
    });
  });

  describe('Recovery codes modal', () => {
    it('dismisses the recovery codes modal when confirmed', async () => {
      vi.mocked(apiModule.setupTotp).mockResolvedValue({
        qrCodeDataUrl: 'data:image/png;base64,abc',
        secret: 'SECRETABC',
      });
      vi.mocked(apiModule.verifyTotpSetup).mockResolvedValue({
        recoveryCodes: ['aaaaa-bbbbb'],
      });
      const refreshUser = vi.fn().mockResolvedValue(undefined);
      vi.mocked(useAuth).mockReturnValue(makeAuthContext({ refreshUser }));

      render(<TwoFactorSection />);

      await act(async () => {
        fireEvent.click(
          screen.getByRole('button', { name: /set up authenticator app/i }),
        );
      });

      const codeInput = screen.getByLabelText(/verification code/i);
      fireEvent.change(codeInput, { target: { value: '123456' } });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /verify/i }));
      });

      await waitFor(() => {
        expect(screen.getByText('aaaaa-bbbbb')).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(
          screen.getByRole('button', { name: /i've saved these codes/i }),
        );
      });

      await waitFor(() => {
        expect(refreshUser).toHaveBeenCalled();
      });
    });
  });
});
