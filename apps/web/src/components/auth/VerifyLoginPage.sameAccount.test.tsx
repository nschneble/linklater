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

describe('VerifyLoginPage same-account branch (already signed in as the link recipient)', () => {
  it('does NOT call loginWithToken when current user matches the magic-link userId', async () => {
    const loginWithToken = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useAuth).mockReturnValue(
      makeAuthContext({ loginWithToken, user: makeUser({ userId: 'user-1' }) }),
    );
    vi.mocked(apiModule.verifyMagicLink).mockResolvedValue({
      accessToken: 'jwt-abc',
      refreshToken: 'refresh-abc',
      userId: 'user-1',
    });

    await act(async () => {
      renderPage();
    });

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith('/unread', { replace: true });
    });
    expect(loginWithToken).not.toHaveBeenCalled();
  });

  it("queues 'already-logged-in' pending notice when the link is for the current user", async () => {
    vi.mocked(useAuth).mockReturnValue(
      makeAuthContext({ user: makeUser({ userId: 'user-1' }) }),
    );
    vi.mocked(apiModule.verifyMagicLink).mockResolvedValue({
      accessToken: 'jwt-abc',
      refreshToken: 'refresh-abc',
      userId: 'user-1',
    });

    await act(async () => {
      renderPage();
    });

    await waitFor(() => {
      expect(pendingNoticeModule.setPendingNotice).toHaveBeenCalledWith(
        'already-logged-in',
      );
    });
  });

  it('does NOT call revokeAllSessions on the same-account branch', async () => {
    vi.mocked(useAuth).mockReturnValue(
      makeAuthContext({ user: makeUser({ userId: 'user-1' }) }),
    );
    vi.mocked(apiModule.verifyMagicLink).mockResolvedValue({
      accessToken: 'jwt-abc',
      refreshToken: 'refresh-abc',
      userId: 'user-1',
    });

    await act(async () => {
      renderPage();
    });

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith('/unread', { replace: true });
    });
    expect(apiModule.revokeAllSessions).not.toHaveBeenCalled();
  });
});
