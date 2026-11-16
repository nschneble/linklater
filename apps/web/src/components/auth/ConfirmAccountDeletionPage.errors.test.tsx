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

describe('ConfirmAccountDeletionPage error paths – redirect to /login with toast', () => {
  it('queues deletion-link-invalid + navigates to /login when no token is present', async () => {
    await act(async () => {
      renderPage('');
    });

    await waitFor(() => {
      expect(pendingNoticeModule.setPendingNotice).toHaveBeenCalledWith(
        'deletion-link-invalid',
      );
    });
    expect(navigate).toHaveBeenCalledWith('/login', { replace: true });
    expect(apiModule.confirmAccountDeletion).not.toHaveBeenCalled();
  });

  it('queues deletion-link-invalid + navigates to /login when confirmAccountDeletion rejects', async () => {
    vi.mocked(apiModule.confirmAccountDeletion).mockRejectedValue(
      new Error('Token expired'),
    );

    await act(async () => {
      renderPage();
    });

    await waitFor(() => {
      expect(pendingNoticeModule.setPendingNotice).toHaveBeenCalledWith(
        'deletion-link-invalid',
      );
    });
    expect(navigate).toHaveBeenCalledWith('/login', { replace: true });
  });

  it('queues deletion-link-invalid + navigates to /login even when a non-Error is thrown', async () => {
    vi.mocked(apiModule.confirmAccountDeletion).mockRejectedValue('boom');

    await act(async () => {
      renderPage();
    });

    await waitFor(() => {
      expect(pendingNoticeModule.setPendingNotice).toHaveBeenCalledWith(
        'deletion-link-invalid',
      );
    });
    expect(navigate).toHaveBeenCalledWith('/login', { replace: true });
  });

  it('does not render the legacy error card (no alert role, no back-to-home button)', async () => {
    vi.mocked(apiModule.confirmAccountDeletion).mockRejectedValue(
      new Error('expired'),
    );

    await act(async () => {
      renderPage();
    });

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith('/login', { replace: true });
    });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: /this link can't be used/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /back to home/i }),
    ).not.toBeInTheDocument();
  });
});
