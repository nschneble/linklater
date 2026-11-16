import { act, fireEvent, screen } from '@testing-library/react';
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

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(apiModule.resetPassword).mockResolvedValue({
    accessToken: 'fresh-jwt',
    refreshToken: 'fresh-refresh',
  });
  refreshUser.mockResolvedValue(undefined);
});

describe('ResetPasswordPage main landmark', () => {
  it.each(['form', 'loading', 'MFA challenge'])(
    'renders exactly one main in the %s state',
    async (state) => {
      if (state === 'loading') {
        vi.mocked(apiModule.resetPassword).mockReturnValue(
          new Promise(() => {}),
        );
      } else {
        vi.mocked(apiModule.resetPassword).mockResolvedValue({
          mfaToken: 'mfa-tok',
          mfaMethod: 'totp',
        });
      }
      const { container } = renderPage();

      if (state !== 'form') {
        fillForm();
        await act(async () => {
          fireEvent.submit(container.querySelector('form')!);
        });
      }
      if (state === 'loading') {
        screen.getByRole('status');
      }
      if (state === 'MFA challenge') {
        await screen.findByRole('heading', {
          name: /multi-factor authentication/i,
        });
      }

      expect(screen.getAllByRole('main')).toHaveLength(1);
    },
  );
});
