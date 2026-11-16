import { act, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderPage } from './ConfirmAccountDeletionPage.testSetup';

vi.mock('../../lib/api', () => ({
  confirmAccountDeletion: vi.fn(),
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
  vi.mocked(apiModule.confirmAccountDeletion).mockResolvedValue(undefined);
});

describe('ConfirmAccountDeletionPage success path (auto-redirect)', () => {
  it('calls logout automatically on success', async () => {
    const logout = vi.fn();
    vi.mocked(useAuth).mockReturnValue(makeAuthContext({ logout }));

    await act(async () => {
      renderPage();
    });

    await waitFor(() => {
      expect(logout).toHaveBeenCalled();
    });
  });
});

describe('ConfirmAccountDeletionPage error paths – redirect to /login with toast', () => {
  it('does not call logout when the API rejects (no session was confirmed deleted)', async () => {
    const logout = vi.fn();
    vi.mocked(useAuth).mockReturnValue(makeAuthContext({ logout }));
    vi.mocked(apiModule.confirmAccountDeletion).mockRejectedValue(
      new Error('expired'),
    );

    await act(async () => {
      renderPage();
    });

    await waitFor(() => {
      expect(pendingNoticeModule.setPendingNotice).toHaveBeenCalledWith(
        'deletion-link-invalid',
      );
    });
    expect(logout).not.toHaveBeenCalled();
  });
});
