import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fillForm, renderPage } from './ResetPasswordPage.testSetup';

vi.mock('../../lib/api', () => ({
  resetPassword: vi.fn(),
  verifyOtp: vi.fn(),
}));

vi.mock('../../lib/pendingNotice', () => ({
  setPendingNotice: vi.fn(),
}));

const refreshUser = vi.fn();

vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({ refreshUser }),
}));

const navigate = vi.fn();

vi.mock('react-router', async () => {
  const actual =
    await vi.importActual<typeof import('react-router')>('react-router');
  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

import * as apiModule from '../../lib/api';
import * as pendingNoticeModule from '../../lib/pendingNotice';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(apiModule.resetPassword).mockResolvedValue({
    accessToken: 'fresh-jwt',
    refreshToken: 'fresh-refresh',
  });
  refreshUser.mockResolvedValue(undefined);
});

describe('ResetPasswordPage MFA path', () => {
  it('mounts MfaView when the server returns an MFA challenge', async () => {
    vi.mocked(apiModule.resetPassword).mockResolvedValue({
      mfaToken: 'mfa-tok',
      mfaMethod: 'totp',
    });
    const { container } = renderPage();

    fillForm();

    await act(async () => {
      fireEvent.submit(container.querySelector('form')!);
    });

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /multi-factor authentication/i }),
      ).toBeInTheDocument();
    });
    expect(refreshUser).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('queues the success notice and navigates to /unread after a valid OTP', async () => {
    vi.mocked(apiModule.resetPassword).mockResolvedValue({
      mfaToken: 'mfa-tok',
      mfaMethod: 'totp',
    });
    vi.mocked(apiModule.verifyOtp).mockResolvedValue({
      accessToken: 'a',
      refreshToken: 'r',
    });
    const { container } = renderPage();

    fillForm();

    await act(async () => {
      fireEvent.submit(container.querySelector('form')!);
    });

    fireEvent.change(screen.getByLabelText(/code/i), {
      target: { value: '123456' },
    });

    await waitFor(() => {
      expect(apiModule.verifyOtp).toHaveBeenCalledWith(
        'mfa-tok',
        '123456',
        'totp',
      );
    });
    await waitFor(() => {
      expect(pendingNoticeModule.setPendingNotice).toHaveBeenCalledWith(
        'password-reset-success',
      );
    });
    expect(navigate).toHaveBeenCalledWith('/unread', { replace: true });
  });
});
