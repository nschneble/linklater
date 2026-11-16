import { act, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderPage } from './TokenVerificationPage.testSetup';

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

import { makeAuthContext } from '../../../test/factories';
import * as pendingNoticeModule from '../../lib/pendingNotice';
import { useAuth } from '../../auth/AuthContext';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useAuth).mockReturnValue(makeAuthContext());
});

describe('TokenVerificationPage success path – signed-out user', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue(makeAuthContext());
  });

  it('queues the signed-out notice key on success', async () => {
    await act(async () => {
      renderPage({
        signedInNotice: 'email-verified',
        signedOutNotice: 'email-verified-please-sign-in',
      });
    });

    await waitFor(() => {
      expect(pendingNoticeModule.setPendingNotice).toHaveBeenCalledWith(
        'email-verified-please-sign-in',
      );
    });
  });

  it('navigates to /login with replace:true on success', async () => {
    await act(async () => {
      renderPage();
    });

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith('/login', { replace: true });
    });
  });

  it('uses the email-change signed-out key for the email-change flow', async () => {
    await act(async () => {
      renderPage({
        signedInNotice: 'email-change-verified',
        signedOutNotice: 'email-change-verified-please-sign-in',
      });
    });

    await waitFor(() => {
      expect(pendingNoticeModule.setPendingNotice).toHaveBeenCalledWith(
        'email-change-verified-please-sign-in',
      );
    });
  });
});
