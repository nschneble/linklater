import {
  render,
  screen,
  waitFor,
  fireEvent,
  act,
} from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import MultiFactorSection from '.';
import type { User } from '../../../auth/AuthContext';

vi.mock('../../../lib/api', () => ({
  cancelTotpSetup: vi.fn(),
  disableMfa: vi.fn(),
  regenerateRecoveryCodes: vi.fn(),
  setupTotp: vi.fn(),
  verifyTotpSetup: vi.fn(),
}));

vi.mock('../../../auth/AuthContext', () => ({
  useAuth: vi.fn(),
}));

import * as apiModule from '../../../lib/api';
import { useAuth } from '../../../auth/AuthContext';

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
    multiFactorMethod: null,
    multiFactorPending: false,
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

describe('MultiFactorSection', () => {
  describe('State A — MFA not enabled', () => {
    it('shows the authenticator app setup button when MFA is not enabled', () => {
      render(<MultiFactorSection />);

      expect(
        screen.getByRole('button', { name: /add authenticator app/i }),
      ).toBeInTheDocument();
    });

    it('labels TOTP as Recommended', () => {
      render(<MultiFactorSection />);

      expect(screen.getByText(/recommended/i)).toBeInTheDocument();
    });
  });

  describe('State A — setupTotp API failure', () => {
    it('shows an error when setupTotp fails to start', async () => {
      vi.mocked(apiModule.setupTotp).mockRejectedValue(
        new Error('Service unavailable'),
      );

      render(<MultiFactorSection />);

      await act(async () => {
        fireEvent.click(
          screen.getByRole('button', { name: /add authenticator app/i }),
        );
      });

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(
          'Service unavailable',
        );
      });
      // State A remains — the setup view should not appear
      expect(
        screen.getByRole('button', { name: /add authenticator app/i }),
      ).toBeInTheDocument();
    });
  });

  describe('State B — TOTP setup in progress', () => {
    it('initiates TOTP setup when the authenticator app button is clicked', async () => {
      vi.mocked(apiModule.setupTotp).mockResolvedValue({
        qrCodeDataUrl: 'data:image/png;base64,abc',
        secret: 'SECRETABC',
      });

      render(<MultiFactorSection />);

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

      render(<MultiFactorSection />);

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

      render(<MultiFactorSection />);

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

    it('cancels in-flight setup from the QR view and returns to State A', async () => {
      vi.mocked(apiModule.setupTotp).mockResolvedValue({
        qrCodeDataUrl: 'data:image/png;base64,abc',
        secret: 'SECRETABC',
      });
      vi.mocked(apiModule.cancelTotpSetup).mockResolvedValue(undefined);

      render(<MultiFactorSection />);

      await act(async () => {
        fireEvent.click(
          screen.getByRole('button', { name: /add authenticator app/i }),
        );
      });

      expect(screen.getByText('SECRETABC')).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
      });

      await waitFor(() => {
        expect(apiModule.cancelTotpSetup).toHaveBeenCalled();
      });
      expect(screen.queryByText('SECRETABC')).not.toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /add authenticator app/i }),
      ).toBeInTheDocument();
    });

    it('shows an error when cancelling setup fails', async () => {
      vi.mocked(apiModule.setupTotp).mockResolvedValue({
        qrCodeDataUrl: 'data:image/png;base64,abc',
        secret: 'SECRETABC',
      });
      vi.mocked(apiModule.cancelTotpSetup).mockRejectedValue(
        new Error('Network down'),
      );

      render(<MultiFactorSection />);

      await act(async () => {
        fireEvent.click(
          screen.getByRole('button', { name: /add authenticator app/i }),
        );
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
      });

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Network down');
      });
      // QR view stays mounted so the user can retry or verify
      expect(screen.getByText('SECRETABC')).toBeInTheDocument();
    });

    it('shows an error when TOTP verification fails', async () => {
      vi.mocked(apiModule.setupTotp).mockResolvedValue({
        qrCodeDataUrl: 'data:image/png;base64,abc',
        secret: 'SECRETABC',
      });
      vi.mocked(apiModule.verifyTotpSetup).mockRejectedValue(
        new Error('Invalid code'),
      );

      render(<MultiFactorSection />);

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
        makeAuthContext({ user: makeUser({ multiFactorMethod: 'totp' }) }),
      );

      render(<MultiFactorSection />);

      expect(screen.getByText(/enabled/i)).toBeInTheDocument();
    });

    it('shows regenerate and disable links when TOTP is active', () => {
      vi.mocked(useAuth).mockReturnValue(
        makeAuthContext({ user: makeUser({ multiFactorMethod: 'totp' }) }),
      );

      render(<MultiFactorSection />);

      expect(
        screen.getByRole('button', { name: /regenerate recovery codes/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /disable multi-factor/i }),
      ).toBeInTheDocument();
    });
  });

  describe('State D — pending TOTP setup (totpSecret set, not yet enabled)', () => {
    it('shows a Continue setup button when setup is pending from a prior session', () => {
      vi.mocked(useAuth).mockReturnValue(
        makeAuthContext({ user: makeUser({ multiFactorPending: true }) }),
      );

      render(<MultiFactorSection />);

      expect(
        screen.getByRole('button', { name: /continue setup/i }),
      ).toBeInTheDocument();
    });

    it('cancels in-flight setup from the Continue setup view and refreshes the user', async () => {
      const refreshUser = vi.fn().mockResolvedValue(undefined);
      vi.mocked(useAuth).mockReturnValue(
        makeAuthContext({
          user: makeUser({ multiFactorPending: true }),
          refreshUser,
        }),
      );
      vi.mocked(apiModule.cancelTotpSetup).mockResolvedValue(undefined);

      render(<MultiFactorSection />);

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
      });

      await waitFor(() => {
        expect(apiModule.cancelTotpSetup).toHaveBeenCalled();
        expect(refreshUser).toHaveBeenCalled();
      });
    });

    it('shows an error when cancelling setup fails from the pending state', async () => {
      vi.mocked(useAuth).mockReturnValue(
        makeAuthContext({ user: makeUser({ multiFactorPending: true }) }),
      );
      vi.mocked(apiModule.cancelTotpSetup).mockRejectedValue(
        new Error('Network error'),
      );

      render(<MultiFactorSection />);

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
      });

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Network error');
      });
      // Continue setup remains visible since cancel failed
      expect(
        screen.getByRole('button', { name: /continue setup/i }),
      ).toBeInTheDocument();
    });

    it('resumes TOTP setup when Continue setup is clicked', async () => {
      vi.mocked(useAuth).mockReturnValue(
        makeAuthContext({ user: makeUser({ multiFactorPending: true }) }),
      );
      vi.mocked(apiModule.setupTotp).mockResolvedValue({
        qrCodeDataUrl: 'data:image/png;base64,abc',
        secret: 'SECRETABC',
      });

      render(<MultiFactorSection />);

      await act(async () => {
        fireEvent.click(
          screen.getByRole('button', { name: /continue setup/i }),
        );
      });

      expect(apiModule.setupTotp).toHaveBeenCalled();
      expect(screen.getByText('SECRETABC')).toBeInTheDocument();
    });
  });

  describe('State C — disable MFA flow', () => {
    it('shows the reauth form when Disable multi-factor is clicked', () => {
      vi.mocked(useAuth).mockReturnValue(
        makeAuthContext({ user: makeUser({ multiFactorMethod: 'totp' }) }),
      );

      render(<MultiFactorSection />);

      fireEvent.click(
        screen.getByRole('button', { name: /disable multi-factor/i }),
      );

      expect(
        screen.getByRole('button', { name: /confirm/i }),
      ).toBeInTheDocument();
    });

    it('calls disableMfa and refreshUser when reauth form is submitted with valid password', async () => {
      const refreshUser = vi.fn().mockResolvedValue(undefined);
      vi.mocked(useAuth).mockReturnValue(
        makeAuthContext({
          user: makeUser({ multiFactorMethod: 'totp' }),
          refreshUser,
        }),
      );
      vi.mocked(apiModule.disableMfa).mockResolvedValue(undefined);

      render(<MultiFactorSection />);

      fireEvent.click(
        screen.getByRole('button', { name: /disable multi-factor/i }),
      );

      fireEvent.change(screen.getByLabelText(/current password/i), {
        target: { value: 'my-password' },
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
      });

      await waitFor(() => {
        expect(apiModule.disableMfa).toHaveBeenCalledWith({
          currentPassword: 'my-password',
          code: undefined,
        });
        expect(refreshUser).toHaveBeenCalled();
      });
    });

    it('shows an error when disableMfa fails', async () => {
      vi.mocked(useAuth).mockReturnValue(
        makeAuthContext({ user: makeUser({ multiFactorMethod: 'totp' }) }),
      );
      vi.mocked(apiModule.disableMfa).mockRejectedValue(
        new Error('Invalid password'),
      );

      render(<MultiFactorSection />);

      fireEvent.click(
        screen.getByRole('button', { name: /disable multi-factor/i }),
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
        makeAuthContext({ user: makeUser({ multiFactorMethod: 'totp' }) }),
      );

      render(<MultiFactorSection />);

      fireEvent.click(
        screen.getByRole('button', { name: /disable multi-factor/i }),
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
        makeAuthContext({ user: makeUser({ multiFactorMethod: 'totp' }) }),
      );

      render(<MultiFactorSection />);

      fireEvent.click(
        screen.getByRole('button', { name: /regenerate recovery codes/i }),
      );

      expect(
        screen.getByRole('button', { name: /confirm/i }),
      ).toBeInTheDocument();
    });

    it('calls regenerateRecoveryCodes and shows new codes on success', async () => {
      vi.mocked(useAuth).mockReturnValue(
        makeAuthContext({ user: makeUser({ multiFactorMethod: 'totp' }) }),
      );
      vi.mocked(apiModule.regenerateRecoveryCodes).mockResolvedValue({
        recoveryCodes: ['new-code-1', 'new-code-2'],
      });

      render(<MultiFactorSection />);

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
        makeAuthContext({ user: makeUser({ multiFactorMethod: 'totp' }) }),
      );
      vi.mocked(apiModule.regenerateRecoveryCodes).mockRejectedValue(
        new Error('Authentication failed'),
      );

      render(<MultiFactorSection />);

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

  describe('Recovery codes panel — inline reveal', () => {
    async function openRecoveryPanel() {
      vi.mocked(apiModule.setupTotp).mockResolvedValue({
        qrCodeDataUrl: 'data:image/png;base64,abc',
        secret: 'SECRETABC',
      });
      vi.mocked(apiModule.verifyTotpSetup).mockResolvedValue({
        recoveryCodes: ['aaaaa-bbbbb', 'ccccc-ddddd'],
      });

      render(<MultiFactorSection />);

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

    it('renders inline rather than as a dialog', async () => {
      await openRecoveryPanel();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('is labelled by the "recovery codes have been generated" heading', async () => {
      await openRecoveryPanel();
      const panel = screen.getByLabelText(
        /your recovery codes have been generated/i,
      );
      expect(panel).toBeInTheDocument();
    });

    it('moves focus to the panel container when opened', async () => {
      await openRecoveryPanel();
      const panel = screen.getByLabelText(
        /your recovery codes have been generated/i,
      );
      expect(document.activeElement).toBe(panel);
    });

    it('hides the Regenerate / Disable actions while the panel is shown', async () => {
      await openRecoveryPanel();
      expect(
        screen.queryByRole('button', { name: /regenerate recovery codes/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /disable multi-factor/i }),
      ).not.toBeInTheDocument();
    });
  });

  describe('Recovery codes panel — confirmation', () => {
    it('dismisses the panel and refreshes the user when confirmed', async () => {
      vi.mocked(apiModule.setupTotp).mockResolvedValue({
        qrCodeDataUrl: 'data:image/png;base64,abc',
        secret: 'SECRETABC',
      });
      vi.mocked(apiModule.verifyTotpSetup).mockResolvedValue({
        recoveryCodes: ['aaaaa-bbbbb'],
      });
      const refreshUser = vi.fn().mockResolvedValue(undefined);
      vi.mocked(useAuth).mockReturnValue(makeAuthContext({ refreshUser }));

      render(<MultiFactorSection />);

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
