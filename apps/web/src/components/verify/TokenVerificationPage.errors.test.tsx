import { act, screen, waitFor } from '@testing-library/react';
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

describe('TokenVerificationPage error paths – redirect to /login with toast', () => {
  it('queues the invalidNotice + navigates to /login when no token is present', async () => {
    const onVerify = vi.fn();

    await act(async () => {
      renderPage({
        search: '',
        onVerify,
        invalidNotice: 'verification-link-invalid',
      });
    });

    await waitFor(() => {
      expect(pendingNoticeModule.setPendingNotice).toHaveBeenCalledWith(
        'verification-link-invalid',
      );
    });
    expect(navigate).toHaveBeenCalledWith('/login', { replace: true });
    expect(onVerify).not.toHaveBeenCalled();
  });

  it('queues the invalidNotice + navigates to /login when onVerify rejects', async () => {
    const onVerify = vi.fn().mockRejectedValue(new Error('Token expired'));

    await act(async () => {
      renderPage({ onVerify, invalidNotice: 'verification-link-invalid' });
    });

    await waitFor(() => {
      expect(pendingNoticeModule.setPendingNotice).toHaveBeenCalledWith(
        'verification-link-invalid',
      );
    });
    expect(navigate).toHaveBeenCalledWith('/login', { replace: true });
  });

  it('queues the invalidNotice + navigates to /login when a non-Error is thrown', async () => {
    const onVerify = vi.fn().mockRejectedValue('boom');

    await act(async () => {
      renderPage({ onVerify, invalidNotice: 'verification-link-invalid' });
    });

    await waitFor(() => {
      expect(pendingNoticeModule.setPendingNotice).toHaveBeenCalledWith(
        'verification-link-invalid',
      );
    });
    expect(navigate).toHaveBeenCalledWith('/login', { replace: true });
  });

  it('uses the email-change-link-invalid key for the email-change flow', async () => {
    const onVerify = vi.fn().mockRejectedValue(new Error('expired'));

    await act(async () => {
      renderPage({ onVerify, invalidNotice: 'email-change-link-invalid' });
    });

    await waitFor(() => {
      expect(pendingNoticeModule.setPendingNotice).toHaveBeenCalledWith(
        'email-change-link-invalid',
      );
    });
    expect(navigate).toHaveBeenCalledWith('/login', { replace: true });
  });

  it('does not render the legacy error card (no alert role, no help text, no back button)', async () => {
    const onVerify = vi.fn().mockRejectedValue(new Error('expired'));

    await act(async () => {
      renderPage({ onVerify });
    });

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith('/login', { replace: true });
    });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /back to linklater/i }),
    ).not.toBeInTheDocument();
  });
});
