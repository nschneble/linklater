import { act, screen, waitFor } from '@testing-library/react';
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
  it('calls confirmAccountDeletion with the token from the URL', async () => {
    vi.mocked(apiModule.confirmAccountDeletion).mockResolvedValue(undefined);

    await act(async () => {
      renderPage('?token=del-token-xyz');
    });

    await waitFor(() => {
      expect(apiModule.confirmAccountDeletion).toHaveBeenCalledWith(
        'del-token-xyz',
      );
    });
  });

  it('queues the account-deleted notice automatically on success', async () => {
    await act(async () => {
      renderPage();
    });

    await waitFor(() => {
      expect(pendingNoticeModule.setPendingNotice).toHaveBeenCalledWith(
        'account-deleted',
      );
    });
  });

  it('navigates to /login with replace:true automatically on success', async () => {
    await act(async () => {
      renderPage();
    });

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith('/login', { replace: true });
    });
  });

  it('does not render an "Account deleted" success card after the API resolves', async () => {
    await act(async () => {
      renderPage();
    });

    // wait for navigate, then confirm no success heading rendered en route
    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith('/login', { replace: true });
    });

    expect(
      screen.queryByRole('heading', { name: /account deleted/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /continue to sign-in/i }),
    ).not.toBeInTheDocument();
  });
});
