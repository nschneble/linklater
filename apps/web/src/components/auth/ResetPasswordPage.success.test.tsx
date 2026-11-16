import { act, fireEvent, waitFor } from '@testing-library/react';
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

describe('ResetPasswordPage success path (non-MFA)', () => {
  it('calls resetPassword with the token and new password', async () => {
    const { container } = renderPage('?token=test-token-abc');

    fillForm();

    await act(async () => {
      fireEvent.submit(container.querySelector('form')!);
    });

    expect(apiModule.resetPassword).toHaveBeenCalledWith(
      'test-token-abc',
      'correct-horse-battery',
    );
  });

  it("queues 'password-reset-success' pending notice on successful reset", async () => {
    const { container } = renderPage();

    fillForm();

    await act(async () => {
      fireEvent.submit(container.querySelector('form')!);
    });

    await waitFor(() => {
      expect(pendingNoticeModule.setPendingNotice).toHaveBeenCalledWith(
        'password-reset-success',
      );
    });
  });

  it('hydrates the auth context and navigates to /unread after a successful reset', async () => {
    const { container } = renderPage();

    fillForm();

    await act(async () => {
      fireEvent.submit(container.querySelector('form')!);
    });

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith('/unread', { replace: true });
    });
    expect(refreshUser).toHaveBeenCalled();
  });
});
