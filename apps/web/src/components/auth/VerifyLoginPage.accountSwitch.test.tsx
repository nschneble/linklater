import { act, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderPage } from './VerifyLoginPage.testSetup';

vi.mock('../../lib/api', () => ({
  revokeAllSessions: vi.fn().mockResolvedValue(undefined),
  verifyMagicLink: vi.fn(),
  verifyOtp: vi.fn(),
}));

vi.mock('../../lib/pendingNotice', () => ({
  setPendingNotice: vi.fn(),
}));

vi.mock('../../auth/AuthContext', () => ({
  useAuth: vi.fn(),
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
import { makeAuthContext, makeUser } from '../../../test/factories';
import * as pendingNoticeModule from '../../lib/pendingNotice';
import { useAuth } from '../../auth/AuthContext';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useAuth).mockReturnValue(makeAuthContext());
});

describe('VerifyLoginPage account-switch branch (logged in as B, link is for A)', () => {
  it('calls revokeAllSessions BEFORE loginWithToken so the bearer is still B', async () => {
    const callOrder: string[] = [];
    vi.mocked(apiModule.revokeAllSessions).mockImplementation(async () => {
      callOrder.push('revokeAllSessions');
    });
    const loginWithToken = vi.fn().mockImplementation(async () => {
      callOrder.push('loginWithToken');
    });
    vi.mocked(useAuth).mockReturnValue(
      makeAuthContext({ loginWithToken, user: makeUser({ userId: 'user-b' }) }),
    );
    vi.mocked(apiModule.verifyMagicLink).mockResolvedValue({
      accessToken: 'jwt-a',
      refreshToken: 'refresh-a',
      userId: 'user-a',
    });

    await act(async () => {
      renderPage();
    });

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith('/unread', { replace: true });
    });
    expect(callOrder).toEqual(['revokeAllSessions', 'loginWithToken']);
  });

  it("queues 'account-switched' pending notice when the link is for a different user", async () => {
    vi.mocked(useAuth).mockReturnValue(
      makeAuthContext({ user: makeUser({ userId: 'user-b' }) }),
    );
    vi.mocked(apiModule.verifyMagicLink).mockResolvedValue({
      accessToken: 'jwt-a',
      refreshToken: 'refresh-a',
      userId: 'user-a',
    });

    await act(async () => {
      renderPage();
    });

    await waitFor(() => {
      expect(pendingNoticeModule.setPendingNotice).toHaveBeenCalledWith(
        'account-switched',
      );
    });
  });

  it('navigates to /unread after the account swap completes', async () => {
    vi.mocked(useAuth).mockReturnValue(
      makeAuthContext({ user: makeUser({ userId: 'user-b' }) }),
    );
    vi.mocked(apiModule.verifyMagicLink).mockResolvedValue({
      accessToken: 'jwt-a',
      refreshToken: 'refresh-a',
      userId: 'user-a',
    });

    await act(async () => {
      renderPage();
    });

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith('/unread', { replace: true });
    });
  });
});
