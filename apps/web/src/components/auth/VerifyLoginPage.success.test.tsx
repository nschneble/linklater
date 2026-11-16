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
import { makeAuthContext } from '../../../test/factories';
import * as pendingNoticeModule from '../../lib/pendingNotice';
import { useAuth } from '../../auth/AuthContext';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useAuth).mockReturnValue(makeAuthContext());
});

describe('VerifyLoginPage success path (no toast – login is login)', () => {
  it('calls verifyMagicLink with the token from the URL', async () => {
    vi.mocked(apiModule.verifyMagicLink).mockResolvedValue({
      accessToken: 'jwt-abc',
      refreshToken: 'refresh-abc',
      userId: 'user-1',
    });

    await act(async () => {
      renderPage('?token=my-magic-token');
    });

    await waitFor(() => {
      expect(apiModule.verifyMagicLink).toHaveBeenCalledWith('my-magic-token');
    });
  });

  it('calls loginWithToken with the access and refresh tokens on success', async () => {
    const loginWithToken = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useAuth).mockReturnValue(makeAuthContext({ loginWithToken }));
    vi.mocked(apiModule.verifyMagicLink).mockResolvedValue({
      accessToken: 'jwt-abc',
      refreshToken: 'refresh-abc',
      userId: 'user-1',
    });

    await act(async () => {
      renderPage();
    });

    await waitFor(() => {
      expect(loginWithToken).toHaveBeenCalledWith('jwt-abc', 'refresh-abc');
    });
  });

  it('navigates to /unread with replace:true after successful verification', async () => {
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
  });

  it('does NOT queue a pending notice on success (magic-link login is just login)', async () => {
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

    expect(pendingNoticeModule.setPendingNotice).not.toHaveBeenCalled();
  });
});
