import { act, screen, waitFor } from '@testing-library/react';
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

describe('VerifyLoginPage MFA challenge', () => {
  it('shows MfaView when verifyMagicLink returns an mfaToken', async () => {
    vi.mocked(apiModule.verifyMagicLink).mockResolvedValue({
      mfaToken: 'mfa-tok-123',
      mfaMethod: 'totp',
    });

    await act(async () => {
      renderPage();
    });

    await waitFor(() => {
      // MfaView renders a TOTP input
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });
  });

  it('does NOT queue a notice or navigate when the MFA branch is taken (handled by handleVerifyOtp)', async () => {
    vi.mocked(apiModule.verifyMagicLink).mockResolvedValue({
      mfaToken: 'mfa-tok-123',
      mfaMethod: 'totp',
    });

    await act(async () => {
      renderPage();
    });

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    expect(pendingNoticeModule.setPendingNotice).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('keeps one main landmark from spinner to branded MFA challenge', async () => {
    let resolveVerify!: (result: {
      mfaMethod: 'totp';
      mfaToken: string;
    }) => void;
    vi.mocked(apiModule.verifyMagicLink).mockReturnValue(
      new Promise((resolve) => {
        resolveVerify = resolve;
      }),
    );

    renderPage();
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(
      screen.getByRole('status').closest('[data-theme="branding"]'),
    ).not.toBeNull();

    await act(async () => {
      resolveVerify({ mfaMethod: 'totp', mfaToken: 'mfa-tok-123' });
    });

    const heading = await screen.findByRole('heading', {
      name: /multi-factor authentication/i,
    });
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(heading.closest('[data-theme="branding"]')).not.toBeNull();
  });
});
