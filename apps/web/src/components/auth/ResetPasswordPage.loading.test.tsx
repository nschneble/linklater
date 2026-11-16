import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ANNOUNCE_DELAY_MS } from '../../lib/liveRegion';
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

describe('ResetPasswordPage success path (non-MFA)', () => {
  describe('announcement timing', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('announces the reset status after the announce delay', async () => {
      // hold the API call open so the loading state stays mounted
      let resolveReset: (value: {
        accessToken: string;
        refreshToken: string;
      }) => void = () => {};
      vi.mocked(apiModule.resetPassword).mockReturnValue(
        new Promise((resolve) => {
          resolveReset = resolve;
        }),
      );
      const { container } = renderPage();

      fillForm();

      await act(async () => {
        fireEvent.submit(container.querySelector('form')!);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(ANNOUNCE_DELAY_MS);
      });

      expect(screen.getByRole('status')).toHaveTextContent(
        /resetting your password/i,
      );

      await act(async () => {
        resolveReset({ accessToken: 'a', refreshToken: 'r' });
      });
    });
  });

  it('does NOT render a "Signing you in" success card or "I\'d like to log in now" button', async () => {
    let resolveReset: (value: {
      accessToken: string;
      refreshToken: string;
    }) => void = () => {};
    vi.mocked(apiModule.resetPassword).mockReturnValue(
      new Promise((resolve) => {
        resolveReset = resolve;
      }),
    );
    const { container } = renderPage();

    fillForm();

    await act(async () => {
      fireEvent.submit(container.querySelector('form')!);
    });

    expect(screen.queryByText(/signing you in/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /i'd like to log in now/i }),
    ).not.toBeInTheDocument();

    await act(async () => {
      resolveReset({ accessToken: 'a', refreshToken: 'r' });
    });
  });
});
