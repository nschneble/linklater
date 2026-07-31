/**
 * Tests for TokenVerificationPage (shared between VerifyEmailPage and
 * VerifyEmailChangePage).
 *
 * State machine: verifying → auto-redirect (success OR failure).
 *
 * Success path is auth-aware:
 *   - Signed-IN user  → setPendingNotice(signedInNotice)  + navigate('/unread')
 *   - Signed-OUT user → setPendingNotice(signedOutNotice) + navigate('/login')
 *
 * Error path (missing token, expired token, server rejection):
 *   - setPendingNotice(invalidNotice) + navigate('/login')
 *
 * The page no longer renders an error card. All failure paths
 * redirect to /login, where the AuthForm surfaces the queued error-variant
 * notice as an assertive toast.
 */

import TokenVerificationPage from './TokenVerificationPage';
import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PendingNotice } from '../../lib/pendingNotice';
import type { User } from '../../auth/AuthContext';

// ─── Module mocks ─────────────────────────────────────────────────────────────

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

// ─── Imports after mocks ──────────────────────────────────────────────────────

import * as pendingNoticeModule from '../../lib/pendingNotice';
import { useAuth } from '../../auth/AuthContext';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeUser(overrides: Partial<User> = {}): User {
  return {
    connectedProviders: [],
    cvdMode: false,
    dyslexicFont: false,
    email: 'test@example.com',
    emailVerifiedAt: '2026-06-14T00:00:00.000Z',
    hasPassword: true,
    pendingEmail: null,
    mode: 'dark',
    theme: 'scanner-darkly',
    multiFactorMethod: null,
    multiFactorPending: false,
    userId: 'user-xyz',
    welcomedAt: '2026-06-14T00:00:00.000Z',
    ...overrides,
  };
}

function makeAuthContext(user: User | null) {
  return {
    loading: false,
    login: vi.fn(),
    loginWithToken: vi.fn(),
    logout: vi.fn(),
    register: vi.fn(),
    refreshUser: vi.fn(),
    resendEmailChangeVerification: vi.fn(),
    resendVerificationEmail: vi.fn(),
    setPendingEmail: vi.fn(),
    markWelcomed: vi.fn(),
    user,
  };
}

interface RenderOptions {
  search?: string;
  onVerify?: ReturnType<typeof vi.fn>;
  onSuccess?: ReturnType<typeof vi.fn>;
  verifyingText?: string;
  signedInNotice?: PendingNotice;
  signedOutNotice?: PendingNotice;
  invalidNotice?: PendingNotice;
}

function renderPage(options: RenderOptions = {}) {
  const search = options.search ?? '?token=valid-token';
  const onVerify = options.onVerify ?? vi.fn().mockResolvedValue(undefined);
  return render(
    <MemoryRouter initialEntries={[`/verify-email${search}`]}>
      <TokenVerificationPage
        verifyingText={options.verifyingText ?? 'Verifying your email…'}
        signedInNotice={options.signedInNotice ?? 'email-verified'}
        signedOutNotice={
          options.signedOutNotice ?? 'email-verified-please-sign-in'
        }
        invalidNotice={options.invalidNotice ?? 'verification-link-invalid'}
        onVerify={onVerify}
        onSuccess={options.onSuccess}
      />
    </MemoryRouter>,
  );
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useAuth).mockReturnValue(makeAuthContext(null));
});

// ─── Verifying state ─────────────────────────────────────────────────────────

describe('TokenVerificationPage verifying state', () => {
  it('renders a polite sr-only status message while the API call is in flight', () => {
    const onVerify = vi.fn().mockReturnValue(new Promise(() => {}));

    renderPage({ onVerify, verifyingText: 'Verifying your email…' });

    const status = screen.getByRole('status');
    expect(status).toBeInTheDocument();
    expect(status).toHaveTextContent(/verifying your email/i);
    // verifying state is a bare spinner; status text lives sr-only
    expect(status).toHaveClass('sr-only');
  });

  it('does not render any card heading during the verifying state', () => {
    const onVerify = vi.fn().mockReturnValue(new Promise(() => {}));

    renderPage({ onVerify, verifyingText: 'Confirming your new email…' });

    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });
});

// ─── Success path (signed-in) ────────────────────────────────────────────────

describe('TokenVerificationPage success path – signed-in user', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue(makeAuthContext(makeUser()));
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

// ─── Success path (signed-out) ───────────────────────────────────────────────

describe('TokenVerificationPage success path – signed-out user', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue(makeAuthContext(null));
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

// ─── Error paths – redirect to /login with toast ──────────────────────────────

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
