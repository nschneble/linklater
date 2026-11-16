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

import { makeAuthContext, makeUser } from '../../../test/factories';
import * as pendingNoticeModule from '../../lib/pendingNotice';
import { useAuth } from '../../auth/AuthContext';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useAuth).mockReturnValue(makeAuthContext());
});

describe('TokenVerificationPage success path – signed-in user', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue(makeAuthContext({ user: makeUser() }));
  });

  it('calls onVerify with the token from the URL', async () => {
    const onVerify = vi.fn().mockResolvedValue(undefined);

    await act(async () => {
      renderPage({ onVerify, search: '?token=tok-abc-123' });
    });

    await waitFor(() => {
      expect(onVerify).toHaveBeenCalledWith('tok-abc-123');
    });
  });

  it('queues the signed-in notice key on success', async () => {
    await act(async () => {
      renderPage({
        signedInNotice: 'email-verified',
        signedOutNotice: 'email-verified-please-sign-in',
      });
    });

    await waitFor(() => {
      expect(pendingNoticeModule.setPendingNotice).toHaveBeenCalledWith(
        'email-verified',
      );
    });
  });

  it('navigates to /unread with replace:true on success', async () => {
    await act(async () => {
      renderPage();
    });

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith('/unread', { replace: true });
    });
  });

  it('awaits onSuccess BEFORE queuing the notice and navigating (deferred-promise pattern)', async () => {
    // deferred promise proves setPendingNotice + navigate wait for onSuccess
    let resolveOnSuccess!: () => void;
    const onSuccessPromise = new Promise<void>((resolve) => {
      resolveOnSuccess = resolve;
    });
    const onSuccess = vi.fn().mockReturnValue(onSuccessPromise);

    await act(async () => {
      renderPage({ onSuccess });
    });

    // let the onVerify().then() chain run up to the pending onSuccess await
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
    });

    // while onSuccess is pending, nothing fires yet: catches a missing await
    expect(pendingNoticeModule.setPendingNotice).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();

    // now resolve onSuccess and confirm the post-await steps fire
    await act(async () => {
      resolveOnSuccess();
    });

    await waitFor(() => {
      expect(pendingNoticeModule.setPendingNotice).toHaveBeenCalled();
    });
    expect(navigate).toHaveBeenCalled();
  });

  it('does not render a success card after the API resolves', async () => {
    await act(async () => {
      renderPage();
    });

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith('/unread', { replace: true });
    });

    // no "Go to Linklater" button, no fa-circle-check success copy
    expect(
      screen.queryByRole('button', { name: /go to linklater/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/your email has been verified/i),
    ).not.toBeInTheDocument();
  });
});
