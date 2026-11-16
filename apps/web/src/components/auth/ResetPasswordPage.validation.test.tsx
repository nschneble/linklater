import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import { renderPage } from './ResetPasswordPage.testSetup';
import ResetPasswordPage from './ResetPasswordPage';

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

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(apiModule.resetPassword).mockResolvedValue({
    accessToken: 'fresh-jwt',
    refreshToken: 'fresh-refresh',
  });
  refreshUser.mockResolvedValue(undefined);
});

describe('ResetPasswordPage client-side validation', () => {
  it('shows an error when no token is in the URL', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/reset-password']}>
        <ResetPasswordPage />
      </MemoryRouter>,
    );

    await act(async () => {
      fireEvent.submit(container.querySelector('form')!);
    });

    expect(screen.getByRole('alert')).toHaveTextContent(/no reset token/i);
    expect(apiModule.resetPassword).not.toHaveBeenCalled();
  });

  it('shows "Passwords do not match" when the confirm field differs', async () => {
    const { container } = renderPage();

    fireEvent.change(screen.getByLabelText(/^new password/i), {
      target: { value: 'correct-horse-battery' },
    });
    fireEvent.change(screen.getByLabelText(/confirm new password/i), {
      target: { value: 'different-password' },
    });

    await act(async () => {
      fireEvent.submit(container.querySelector('form')!);
    });

    expect(screen.getByRole('alert')).toHaveTextContent(
      /passwords do not match/i,
    );
    expect(apiModule.resetPassword).not.toHaveBeenCalled();
  });
});
