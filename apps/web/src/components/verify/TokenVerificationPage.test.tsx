/**
 * Tests for TokenVerificationPage (shared between VerifyEmailPage and
 * VerifyEmailChangePage).
 *
 * State machine: verifying → (auto-redirect on success) | error
 *
 * Success path is auth-aware:
 *   - Signed-IN user  → setPendingNotice(signedInNotice key)  + navigate('/unread')
 *   - Signed-OUT user → setPendingNotice(signedOutNotice key) + navigate('/login')
 *
 * Error path keeps the full interstitial card (Wave 4 scope unchanged).
 */

import TokenVerificationPage from './TokenVerificationPage';
import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
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

vi.mock('react-router-dom', async () => {
  const actual =
    await vi.importActual<typeof import('react-router-dom')>(
      'react-router-dom',
    );
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
    resendVerificationEmail: vi.fn(),
    setPendingEmail: vi.fn(),
    markWelcomed: vi.fn(),
    user,
  };
}

interface RenderOptions {
  search?: string;
  verifyFn?: ReturnType<typeof vi.fn>;
  onSuccess?: ReturnType<typeof vi.fn>;
  title?: string;
  verifyingText?: string;
  helpText?: string;
  signedInNotice?: PendingNotice;
  signedOutNotice?: PendingNotice;
}

function renderPage(options: RenderOptions = {}) {
  const search = options.search ?? '?token=valid-token';
  const verifyFn = options.verifyFn ?? vi.fn().mockResolvedValue(undefined);
  return render(
    <MemoryRouter initialEntries={[`/verify-email${search}`]}>
      <TokenVerificationPage
        title={options.title ?? 'Email Verification'}
        verifyingText={options.verifyingText ?? 'Verifying your email…'}
        signedInNotice={options.signedInNotice ?? 'email-verified'}
        signedOutNotice={
          options.signedOutNotice ?? 'email-verified-please-sign-in'
        }
        helpText={options.helpText ?? 'The link may have expired.'}
        verifyFn={verifyFn}
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
  it('shows a polite status message while the API call is in flight', () => {
    const verifyFn = vi.fn().mockReturnValue(new Promise(() => {}));

    renderPage({ verifyFn, verifyingText: 'Verifying your email…' });

    const status = screen.getByRole('status');
    expect(status).toBeInTheDocument();
    expect(status).toHaveTextContent(/verifying your email/i);
  });

  it('renders the configured page title', () => {
    const verifyFn = vi.fn().mockReturnValue(new Promise(() => {}));

    renderPage({ verifyFn, title: 'Email Change' });

    expect(
      screen.getByRole('heading', { name: /email change/i }),
    ).toBeInTheDocument();
  });
});

// ─── Success path (signed-in) ────────────────────────────────────────────────

describe('TokenVerificationPage success path — signed-in user', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue(makeAuthContext(makeUser()));
  });

  it('calls verifyFn with the token from the URL', async () => {
    const verifyFn = vi.fn().mockResolvedValue(undefined);

    await act(async () => {
      renderPage({ verifyFn, search: '?token=tok-abc-123' });
    });

    await waitFor(() => {
      expect(verifyFn).toHaveBeenCalledWith('tok-abc-123');
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
    // C5: the resolved-order test below uses a deferred promise so we can
    // observe that setPendingNotice + navigate are NOT called while
    // onSuccess is still pending. The previous ordering-array trick would
    // have passed even if the awaits ran in parallel; this version
    // proves the await sequence.
    let resolveOnSuccess!: () => void;
    const onSuccessPromise = new Promise<void>((resolve) => {
      resolveOnSuccess = resolve;
    });
    const onSuccess = vi.fn().mockReturnValue(onSuccessPromise);

    await act(async () => {
      renderPage({ onSuccess });
    });

    // Let the verifyFn().then() callback run up to the awaited onSuccess call,
    // which is now pending on resolveOnSuccess.
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
    });

    // Critical assertion: while onSuccess is still pending, neither the
    // notice queue nor the navigation has fired yet. This catches the
    // bug where the await is missing or accidentally fire-and-forget.
    expect(pendingNoticeModule.setPendingNotice).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();

    // Now resolve onSuccess and confirm the post-await steps fire.
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

    // No "Go to Linklater" button, no fa-circle-check success copy.
    expect(
      screen.queryByRole('button', { name: /go to linklater/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/your email has been verified/i),
    ).not.toBeInTheDocument();
  });
});

// ─── Success path (signed-out) ───────────────────────────────────────────────

describe('TokenVerificationPage success path — signed-out user', () => {
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

// ─── Error paths ─────────────────────────────────────────────────────────────

describe('TokenVerificationPage error paths', () => {
  it('shows an error alert when no token is present in the URL', async () => {
    const verifyFn = vi.fn();

    await act(async () => {
      renderPage({ search: '', verifyFn });
    });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    expect(verifyFn).not.toHaveBeenCalled();
    expect(pendingNoticeModule.setPendingNotice).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('shows the API error message when verifyFn rejects', async () => {
    const verifyFn = vi.fn().mockRejectedValue(new Error('Token expired'));

    await act(async () => {
      renderPage({ verifyFn });
    });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/token expired/i);
    });

    expect(pendingNoticeModule.setPendingNotice).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('shows the fallback error message when a non-Error is thrown', async () => {
    const verifyFn = vi.fn().mockRejectedValue('boom');

    await act(async () => {
      renderPage({ verifyFn });
    });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        /verification failed/i,
      );
    });
  });

  it('renders the configured help text in the error state', async () => {
    const verifyFn = vi.fn().mockRejectedValue(new Error('expired'));

    await act(async () => {
      renderPage({
        verifyFn,
        helpText: 'Request a new verification email from Settings.',
      });
    });

    await waitFor(() => {
      expect(
        screen.getByText(/request a new verification email from settings/i),
      ).toBeInTheDocument();
    });
  });
});
