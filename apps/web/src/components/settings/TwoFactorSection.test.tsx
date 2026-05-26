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
  setupTotp: vi.fn(),
  verifyTotpSetup: vi.fn(),
}));

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
    it('shows the authenticator app setup button when 2FA is not enabled', () => {
      render(<TwoFactorSection />);

      expect(
        screen.getByRole('button', { name: /add authenticator app/i }),
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
          screen.getByRole('button', { name: /add authenticator app/i }),
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
          screen.getByRole('button', { name: /add authenticator app/i }),
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

    it('auto-submits TOTP verification code when 6 digits are entered without clicking Verify', async () => {
      vi.mocked(apiModule.setupTotp).mockResolvedValue({
        qrCodeDataUrl: 'data:image/png;base64,abc',
        secret: 'SECRETABC',
      });
      vi.mocked(apiModule.verifyTotpSetup).mockResolvedValue({
        recoveryCodes: ['aaaaa-bbbbb'],
      });

      render(<TwoFactorSection />);

      await act(async () => {
        fireEvent.click(
          screen.getByRole('button', { name: /add authenticator app/i }),
        );
      });

      await act(async () => {
        fireEvent.change(screen.getByLabelText(/verification code/i), {
          target: { value: '123456' },
        });
      });

      await waitFor(() => {
        expect(apiModule.verifyTotpSetup).toHaveBeenCalledWith('123456');
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
          screen.getByRole('button', { name: /add authenticator app/i }),
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

  describe('State D — pending TOTP setup (totpSecret set, not yet enabled)', () => {
    it('shows a Continue setup button when setup is pending from a prior session', () => {
      vi.mocked(useAuth).mockReturnValue(
        makeAuthContext({ user: makeUser({ twoFactorPending: true }) }),
      );

      render(<TwoFactorSection />);

      expect(
        screen.getByRole('button', { name: /continue setup/i }),
      ).toBeInTheDocument();
    });

    it('resumes TOTP setup when Continue setup is clicked', async () => {
      vi.mocked(useAuth).mockReturnValue(
        makeAuthContext({ user: makeUser({ twoFactorPending: true }) }),
      );
      vi.mocked(apiModule.setupTotp).mockResolvedValue({
        qrCodeDataUrl: 'data:image/png;base64,abc',
        secret: 'SECRETABC',
      });

      render(<TwoFactorSection />);

      await act(async () => {
        fireEvent.click(
          screen.getByRole('button', { name: /continue setup/i }),
        );
      });

      expect(apiModule.setupTotp).toHaveBeenCalled();
      expect(screen.getByText('SECRETABC')).toBeInTheDocument();
    });
  });

  describe('State C — disable 2FA flow', () => {
    it('shows the reauth form when Disable two-factor is clicked', () => {
      vi.mocked(useAuth).mockReturnValue(
        makeAuthContext({ user: makeUser({ twoFactorMethod: 'totp' }) }),
      );

      render(<TwoFactorSection />);

      fireEvent.click(
        screen.getByRole('button', { name: /disable two-factor/i }),
      );

      expect(
        screen.getByRole('button', { name: /confirm/i }),
      ).toBeInTheDocument();
    });

    it('calls disable2fa and refreshUser when reauth form is submitted with valid password', async () => {
      const refreshUser = vi.fn().mockResolvedValue(undefined);
      vi.mocked(useAuth).mockReturnValue(
        makeAuthContext({
          user: makeUser({ twoFactorMethod: 'totp' }),
          refreshUser,
        }),
      );
      vi.mocked(apiModule.disable2fa).mockResolvedValue(undefined);

      render(<TwoFactorSection />);

      fireEvent.click(
        screen.getByRole('button', { name: /disable two-factor/i }),
      );

      fireEvent.change(screen.getByLabelText(/current password/i), {
        target: { value: 'my-password' },
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
      });

      await waitFor(() => {
        expect(apiModule.disable2fa).toHaveBeenCalledWith({
          currentPassword: 'my-password',
          code: undefined,
        });
        expect(refreshUser).toHaveBeenCalled();
      });
    });

    it('shows an error when disable2fa fails', async () => {
      vi.mocked(useAuth).mockReturnValue(
        makeAuthContext({ user: makeUser({ twoFactorMethod: 'totp' }) }),
      );
      vi.mocked(apiModule.disable2fa).mockRejectedValue(
        new Error('Invalid password'),
      );

      render(<TwoFactorSection />);

      fireEvent.click(
        screen.getByRole('button', { name: /disable two-factor/i }),
      );
      fireEvent.change(screen.getByLabelText(/current password/i), {
        target: { value: 'wrong-password' },
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
      });

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Invalid password');
      });
    });

    it('hides the reauth form when Cancel is clicked', () => {
      vi.mocked(useAuth).mockReturnValue(
        makeAuthContext({ user: makeUser({ twoFactorMethod: 'totp' }) }),
      );

      render(<TwoFactorSection />);

      fireEvent.click(
        screen.getByRole('button', { name: /disable two-factor/i }),
      );
      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

      expect(
        screen.queryByRole('button', { name: /confirm/i }),
      ).not.toBeInTheDocument();
    });
  });

  describe('State C — regenerate recovery codes flow', () => {
    it('shows the reauth form when Regenerate recovery codes is clicked', () => {
      vi.mocked(useAuth).mockReturnValue(
        makeAuthContext({ user: makeUser({ twoFactorMethod: 'totp' }) }),
      );

      render(<TwoFactorSection />);

      fireEvent.click(
        screen.getByRole('button', { name: /regenerate recovery codes/i }),
      );

      expect(
        screen.getByRole('button', { name: /confirm/i }),
      ).toBeInTheDocument();
    });

    it('calls regenerateRecoveryCodes and shows new codes on success', async () => {
      vi.mocked(useAuth).mockReturnValue(
        makeAuthContext({ user: makeUser({ twoFactorMethod: 'totp' }) }),
      );
      vi.mocked(apiModule.regenerateRecoveryCodes).mockResolvedValue({
        recoveryCodes: ['new-code-1', 'new-code-2'],
      });

      render(<TwoFactorSection />);

      fireEvent.click(
        screen.getByRole('button', { name: /regenerate recovery codes/i }),
      );
      fireEvent.change(screen.getByLabelText(/current password/i), {
        target: { value: 'my-password' },
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
      });

      await waitFor(() => {
        expect(screen.getByText('new-code-1')).toBeInTheDocument();
      });
    });

    it('shows an error when regenerateRecoveryCodes fails', async () => {
      vi.mocked(useAuth).mockReturnValue(
        makeAuthContext({ user: makeUser({ twoFactorMethod: 'totp' }) }),
      );
      vi.mocked(apiModule.regenerateRecoveryCodes).mockRejectedValue(
        new Error('Authentication failed'),
      );

      render(<TwoFactorSection />);

      fireEvent.click(
        screen.getByRole('button', { name: /regenerate recovery codes/i }),
      );
      fireEvent.change(screen.getByLabelText(/current password/i), {
        target: { value: 'wrong-pass' },
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
      });

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(
          'Authentication failed',
        );
      });
    });
  });

  describe('Recovery codes modal — dialog accessibility', () => {
    async function openRecoveryModal() {
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
          screen.getByRole('button', { name: /add authenticator app/i }),
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
    }

    it('renders with role="dialog"', async () => {
      await openRecoveryModal();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('has aria-modal="true" on the dialog', async () => {
      await openRecoveryModal();
      expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
    });

    it('receives focus when opened', async () => {
      await openRecoveryModal();
      const dialog = screen.getByRole('dialog');
      expect(document.activeElement).toBe(dialog);
    });

    it('closes when Escape is pressed', async () => {
      await openRecoveryModal();
      const dialog = screen.getByRole('dialog');

      await act(async () => {
        fireEvent.keyDown(dialog, { key: 'Escape' });
      });

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('is labelled by the "Save your recovery codes" heading', async () => {
      await openRecoveryModal();
      const dialog = screen.getByRole('dialog');
      const labelId = dialog.getAttribute('aria-labelledby');
      expect(labelId).toBeTruthy();
      const heading = document.getElementById(labelId!);
      expect(heading).toHaveTextContent(/save your recovery codes/i);
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
          screen.getByRole('button', { name: /add authenticator app/i }),
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
